// pages/chat/index.js
const app = getApp();
const { chatCancelable } = require('../../utils/llm.js');

// ←←← 如镜子页路径不同，请替换
const MIRROR_URL = '/pages/mirror/index';

let cancelChat = null;
let timer = null;

Page({
  data:{
    tab:'chat',
    tag:'#与自己同在',
    msgs:[
      { id:'hi', role:'ai', text:'我在，先把注意力放回到你身上。今天想从哪一件小事说起？' }
    ],
    skills:[],
    inp:'',
    sending:false,

    // 弹层 & 计时器
    showSkill:false,
    skill:{ title:'', steps:[], alt:'' },

    // 数字秒 + 展示文本
    secondsLeft: 0,
    countdownText: '' // "2:00" / "完成 ✅"
  },

  onLoad(){
    const ctx = app?.globalData?.chatContext || {};
    if (ctx?.topics?.length) this.setData({ tag: '#' + ctx.topics[0] });
    if (ctx?.summary) {
      const msgs = this.data.msgs.slice();
      msgs.push({ id: Date.now()+'sum', role:'obj', text: '我从你的叙述里听到的主线是：' + ctx.summary });
      this.setData({ msgs });
    }
  },
  

  onUnload(){
    if (cancelChat) { try{ cancelChat(); }catch(e){} cancelChat = null; }
    this._stopTimer();
  },

  toChat(){ this.setData({ tab:'chat' }); },
  toSOS(){ this.setData({ tab:'sos'  }); },

  onInp(e){ this.setData({ inp: (e.detail && e.detail.value) || '' }); },

  /* ===================== 发送 & LLM ===================== */
  async send(){
    const text = (this.data.inp || '').trim();
    if (!text || this.data.sending) return;

    const userMsg = { id: 'u'+Date.now(), role:'user', text };
    const msgs = this.data.msgs.concat(userMsg);
    this.setData({ msgs, inp:'', sending:true });

    // 取最近 8 条作为上下文
    const history = msgs.slice(-8).map(m => ({
      role: m.role === 'ai' || m.role === 'obj' ? 'assistant' : m.role,
      content: m.text
    }));

    if (cancelChat) { try{ cancelChat(); }catch(e){} }
    const { promise, cancel } = chatCancelable(history, this.data.tag);
    cancelChat = cancel;

    try{
      const out = await promise;
      cancelChat = null;

      const next = this.data.msgs.slice();
      if (out.reply)     next.push({ id:'a'+Date.now(), role:'ai',  text: out.reply });
      if (out.objective) next.push({ id:'o'+Date.now(), role:'obj', text: out.objective });

      // 合并技能卡（去重）
      const skills = mergeSkills(this.data.skills, out.skills || []);
      this.setData({ msgs: next, skills, sending:false });
    }catch(e){
      cancelChat = null;
      this.setData({ sending:false });
      tt.showToast({ title:'生成失败', icon:'none' });
    }
  },

  /* ===================== 功能卡弹层 ===================== */
  openSkill(e){
    const id = e.currentTarget.dataset.id;
    const it = (this.data.skills || []).find(s => s.id === id);
    if (!it) return;
    // 重置倒计时
    this._stopTimer();
    this.setData({
      skill: it,
      showSkill: true,
      secondsLeft: 0,
      countdownText: ''
    });
  },

  // 跳过（弹层）→ 直接回镜子页
  skipSkill(){
    this._stopTimer();
    this.setData({ showSkill:false, secondsLeft:0, countdownText:'' });
    this._goMirror();
  },

  // 跳过（SOS）→ 直接回镜子页
  skipSOS(){
    this._stopTimer();
    this.setData({ secondsLeft:0, countdownText:'' });
    this._goMirror();
  },

  // 返回对话（不导航）
  returnToChat(){
    this._stopTimer();
    // 若在弹层，则关闭；若在 SOS，则切回对话 Tab
    if (this.data.showSkill) this.setData({ showSkill:false });
    if (this.data.tab === 'sos') this.setData({ tab:'chat' });
    // 不追加任何消息，不弹 Toast —— “就返回对话就好”
  },

  // 开始计时（data-duration 支持传秒数）
  startTimer(e){
    const dur = Number(e?.currentTarget?.dataset?.duration) || 120; // 默认 120 秒
    // 记录来源：skill 弹层 or SOS
    this._timerFrom = this.data.showSkill ? 'skill' : (this.data.tab === 'sos' ? 'sos' : 'chat');

    // 清掉旧的
    this._stopTimer();

    // 立即渲染一次
    this.setData({
      secondsLeft: dur,
      countdownText: this._fmt(dur)
    });

      timer = setInterval(() => {
    let left = this.data.secondsLeft - 1;
    if (left <= 0) {
      this._stopTimer();
      this.setData({ secondsLeft: 0, countdownText: '完成 ✅' });

      // 结束反馈 + 返回镜子
      const fb = this._buildFinishFeedback();
      this._appendFeedback(fb);
      
      // 保存行为卡
      if (this._timerFrom === 'skill') {
        this._saveSkillToActions(this.data.skill);
        this.setData({ showSkill: false });
      } else if (this._timerFrom === 'sos') {
        this._saveSkillToActions({
          title: '2 分钟呼吸练习',
          steps: ['吸气 4 拍', '停留 4 拍', '呼气 4 拍', '停留 4 拍，循环 8 次']
        });
      }
      
      setTimeout(() => this._goMirror(), 900);
    } else {
      this.setData({ secondsLeft: left, countdownText: this._fmt(left) });
    }
  }, 1000);
  },

  /* ===================== 辅助 & 导航 ===================== */
  _fmt(n){
    const m = Math.floor(n/60);
    const s = n%60;
    return `${m}:${String(s).padStart(2,'0')}`;
  },

  _stopTimer(){
    if (timer){ clearInterval(timer); timer = null; }
  },

  _buildFinishFeedback(){
    if (this._timerFrom === 'skill' && this.data.skill?.title) {
      return `做得很好！你已完成「${this.data.skill.title}」。留意下此刻的呼吸与身体感觉。`;
    }
    if (this._timerFrom === 'sos') {
      return '做得很棒，2 分钟的节律呼吸完成。我们回到镜子页。';
    }
    return '小练习完成啦，我们回到镜子页。';
  },

  _appendFeedback(text){
    const msgs = this.data.msgs.slice();
    msgs.push({ id:'done'+Date.now(), role:'ai', text });
    this.setData({ msgs });
    tt.showToast({ title:'已完成', icon:'success' });
  },
  _saveSkillToActions(skill) {
  if (!skill || !skill.title) return;
  
  // 获取当前行为卡信息
  const act = app.globalData.actions;
  act.unshift({ 
    text: `完成：${skill.title}`, 
    at: new Date().toISOString(),
    skill: skill
  });
  
  // 保存到全局数据和缓存
  app.globalData.actions = act; 
  app.persist();
  
  // 同时保存到 inner_events_v1 中
  const stored = tt.getStorageSync('inner_events_v1') || {};
  const actions = stored.actions || [];
  actions.unshift({
    text: `完成：${skill.title}`,
    time: new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
    at: new Date().toISOString(),
    skill: skill
  });
  stored.actions = actions;
  
  // 保存技能卡到 skills 数组
  const skills = stored.skills || [];
  const skillId = skill.id || skill.title.toLowerCase().replace(/\s+/g, '_');
  
  // 检查是否已存在相同 ID 的技能卡
  if (!skills.find(s => s.id === skillId)) {
    skills.push({
      id: skillId,
      title: skill.title,
      meta: skill.meta || '练习技能',
      steps: skill.steps || []
    });
    stored.skills = skills;
  }
  
  tt.setStorageSync('inner_events_v1', stored);
},

  _goMirror(){
    try {
      const pages = getCurrentPages();
      let idx = -1;
      for (let i=0;i<pages.length;i++){
        const r = pages[i].route;
        if (r === 'pages/mirror/index' || r === 'pages/mirror/mirror') { idx = i; break; }
      }
      if (idx >= 0) {
        const delta = pages.length - 1 - idx;
        if (delta > 0) { tt.navigateBack({ delta }); return; }
      }
    } catch(e){ /* ignore */ }

    tt.switchTab({
      url: MIRROR_URL,
      fail: ()=> tt.reLaunch({ url: MIRROR_URL })
    });
  }
});

/* =============== 工具：合并 & 去重技能卡 =============== */
function mergeSkills(cur = [], add = []){
  const map = new Map();
  [...cur, ...add].forEach(s=>{
    const k = (s.id || s.title || '').toLowerCase();
    if (!k) return;
    if (!map.has(k)) map.set(k, s);
  });
  return Array.from(map.values());
}

