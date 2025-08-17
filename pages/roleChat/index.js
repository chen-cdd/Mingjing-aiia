// pages/roleChat/index.js
const app = getApp();
const { chatCancelable } = require('../../utils/llm.js');

let cancelChat = null;

Page({
  data: {
    personId: '',
    personName: '',
    personProfile: '',
    customProfile: '',
    msgs: [],
    inp: '',
    sending: false,
    showProfileModal: false,
    aiGeneratedProfile: '',
    isEditingProfile: false
  },

  onLoad(options) {
    const { personId, personName } = options;
    if (!personId || !personName) {
      tt.showToast({
        title: '参数错误',
        icon: 'none'
      });
      setTimeout(() => {
        tt.navigateBack();
      }, 1500);
      return;
    }

    this.setData({
      personId,
      personName
    });

    // 生成AI角色设定
    this.generateAIProfile();
    
    // 初始化对话
    this.initChat();
  },

  onUnload() {
    if (cancelChat) {
      try {
        cancelChat();
      } catch (e) {}
      cancelChat = null;
    }
  },

  // 初始化对话
  initChat() {
    const welcomeMsg = {
      id: 'welcome_' + Date.now(),
      role: 'ai',
      text: `你好！我是${this.data.personName}。很高兴能和你在这里对话。有什么想聊的吗？`
    };
    
    this.setData({
      msgs: [welcomeMsg]
    });
  },

  // 生成AI角色设定
  generateAIProfile() {
    // 从全局数据或本地存储获取人物信息
    const chatContext = app.globalData.chatContext || {};
    const personEvents = this.getPersonEvents(this.data.personId);
    
    let profile = `角色名称：${this.data.personName}\n`;
    profile += `角色身份：基于真实关系的AI分身\n\n`;
    
    if (personEvents.length > 0) {
      profile += `性格特征：\n`;
      
      // 基于事件分析性格
      const eventTexts = personEvents.map(e => e.text || e.summary || '').join(' ');
      
      if (eventTexts.includes('工作') || eventTexts.includes('项目')) {
        profile += `- 工作认真负责，善于合作\n`;
      }
      if (eventTexts.includes('电影') || eventTexts.includes('娱乐')) {
        profile += `- 热爱生活，喜欢娱乐活动\n`;
      }
      if (eventTexts.includes('运动') || eventTexts.includes('锻炼')) {
        profile += `- 注重健康，喜欢运动锻炼\n`;
      }
      if (eventTexts.includes('设计') || eventTexts.includes('创意')) {
        profile += `- 富有创意，对艺术敏感\n`;
      }
      
      profile += `\n共同经历：\n`;
      personEvents.slice(0, 5).forEach((event, index) => {
        const summary = event.summary || event.text?.substring(0, 30) || '未知事件';
        const time = event.createTime || event.time || '未知时间';
        profile += `${index + 1}. ${summary} (${time})\n`;
      });
      
      if (personEvents.length > 5) {
        profile += `... 还有 ${personEvents.length - 5} 个事件\n`;
      }
      
      profile += `\n对话风格：\n`;
      profile += `- 基于以上经历，在对话中体现相应的性格特点和兴趣爱好\n`;
      profile += `- 以朋友的身份进行对话，温暖而真诚\n`;
      profile += `- 可以回忆和讨论共同的经历\n`;
      profile += `- 提供情感支持和建议\n`;
      profile += `- 模拟未来可能的对话场景`;
    } else {
      profile += `暂无共同经历记录，将基于一般朋友关系进行对话。\n\n`;
      profile += `对话风格：\n`;
      profile += `- 以友善、支持的态度进行对话\n`;
      profile += `- 提供情感支持和陪伴\n`;
      profile += `- 帮助用户进行情景演练和心理准备`;
    }
    
    this.setData({
      aiGeneratedProfile: profile,
      personProfile: profile
    });
  },

  // 获取人物相关事件
  getPersonEvents(personId) {
    try {
      const timeline = tt.getStorageSync('timeline') || [];
      return timeline.filter(event => {
        const persons = event.persons || [];
        return persons.some(p => p.id === personId);
      });
    } catch (e) {
      console.error('获取人物事件失败:', e);
      return [];
    }
  },

  // 输入处理
  onInp(e) {
    this.setData({
      inp: e.detail.value || ''
    });
  },

  // 发送消息
  async send() {
    const text = (this.data.inp || '').trim();
    if (!text || this.data.sending) return;

    const userMsg = {
      id: 'u' + Date.now(),
      role: 'user',
      text
    };
    
    const msgs = this.data.msgs.concat(userMsg);
    this.setData({
      msgs,
      inp: '',
      sending: true
    });

    // 构建对话历史
    const history = msgs.slice(-8).map(m => ({
      role: m.role === 'ai' ? 'assistant' : m.role,
      content: m.text
    }));

    // 添加角色设定作为系统提示
    const systemPrompt = {
      role: 'system',
      content: `你现在要扮演${this.data.personName}这个角色。以下是角色设定：\n\n${this.data.personProfile}\n\n请严格按照这个角色设定进行对话，保持角色的一致性。`
    };

    const fullHistory = [systemPrompt, ...history];

    if (cancelChat) {
      try {
        cancelChat();
      } catch (e) {}
    }

    const { promise, cancel } = chatCancelable(fullHistory, `#与${this.data.personName}对话`);
    cancelChat = cancel;

    try {
      const out = await promise;
      cancelChat = null;

      const next = this.data.msgs.slice();
      if (out.reply) {
        next.push({
          id: 'a' + Date.now(),
          role: 'ai',
          text: out.reply
        });
      }

      this.setData({
        msgs: next,
        sending: false
      });
    } catch (e) {
      cancelChat = null;
      this.setData({
        sending: false
      });
      tt.showToast({
        title: '发送失败',
        icon: 'none'
      });
    }
  },

  // 查看角色设定
  viewProfile() {
    this.setData({
      showProfileModal: true,
      isEditingProfile: false,
      customProfile: this.data.customProfile || ''
    });
  },

  // 关闭角色设定弹窗
  closeProfileModal() {
    this.setData({
      showProfileModal: false
    });
  },

  // 阻止事件冒泡
  stopPropagation() {
    // 阻止点击弹窗内容时关闭弹窗
  },

  // 编辑角色设定
  editProfile() {
    this.setData({
      isEditingProfile: true,
      customProfile: this.data.personProfile
    });
  },

  // 取消编辑
  cancelEdit() {
    this.setData({
      isEditingProfile: false,
      customProfile: ''
    });
  },

  // 自定义设定输入
  onCustomProfileInput(e) {
    this.setData({
      customProfile: e.detail.value
    });
  },

  // 重新生成角色设定
  regenerateProfile() {
    this.generateAIProfile();
    tt.showToast({
      title: '已重新生成',
      icon: 'success'
    });
  },

  // 保存角色设定
  saveProfile() {
    const newProfile = this.data.customProfile.trim();
    if (!newProfile) {
      tt.showToast({
        title: '请输入角色设定',
        icon: 'none'
      });
      return;
    }

    this.setData({
      personProfile: newProfile,
      isEditingProfile: false,
      showProfileModal: false
    });

    // 保存到本地存储
    try {
      const profiles = tt.getStorageSync('roleProfiles') || {};
      profiles[this.data.personId] = newProfile;
      tt.setStorageSync('roleProfiles', profiles);
    } catch (e) {
      console.error('保存角色设定失败:', e);
    }

    tt.showToast({
      title: '保存成功',
      icon: 'success'
    });
  },

  // 返回上一页
  goBack() {
    tt.navigateBack();
  }
});