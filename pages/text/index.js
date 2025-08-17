const app = getApp();
const { analyzeCancelable } = require('../../utils/llm.js');

Page({
  data: { 
    text: '',
    mode: 'new', // 默认为新建模式
    isEditing: false,
    item: null // 用于存储查看的记录项
  },
  
  onLoad(options) {
    // 根据参数设置模式
    if (options.mode) {
      this.setData({ mode: options.mode });
      
      // 如果是查看模式，从缓存加载记录
      if (options.mode === 'view' && options.id) {
        // 从 inner_events_v1 中获取时间线数据
        const stored = tt.getStorageSync('inner_events_v1') || {};
        const timeline = stored.timeline || [];
        const item = timeline.find(r => r.id === options.id);
        
        if (item) {
          this.setData({
            item: item,
            text: item.text
          });
        } else {
          tt.showToast({ title: '记录不存在', icon: 'none' });
          setTimeout(() => {
            tt.navigateBack();
          }, 1500);
        }
      }
    }
  },
  
  onInput(e) { 
    this.setData({ text: e.detail.value }); 
  },
  
  toggleEdit() {
    this.setData({ isEditing: !this.data.isEditing });
  },
  
  back() {
    tt.navigateBack();
  },
  
  save() {
    const t = this.data.text.trim();
    if (!t) { 
      tt.showToast({ title: '先写点内容吧', icon: 'none' }); 
      return; 
    }
    
    // 根据模式执行不同的保存逻辑
    if (this.data.mode === 'view' && this.data.isEditing) {
      // 编辑模式 - 更新现有记录
      this.updateExistingRecord(t);
    } else {
      // 新建模式 - 创建新记录
      this.createNewRecord(t);
    }
  },
  
  updateExistingRecord(text) {
    // 获取存储的事件数据
    const stored = tt.getStorageSync('inner_events_v1') || {};
    const timeline = stored.timeline || [];
    const index = timeline.findIndex(r => r.id === this.data.item.id);
    
    if (index !== -1) {
      // 更新记录
      timeline[index].text = text;
      timeline[index].updateTime = new Date().toISOString();
      
      // 重新分析文本
      this.reanalyzeText(text, timeline, index);
    }
  },
  
  reanalyzeText(text, timeline, index) {
    tt.showLoading({ title: '分析中...' });
    
    // 调用 LLM 进行分析
    const { promise, cancel } = analyzeCancelable(text);
    
    promise.then(result => {
      // 更新记录的分析结果
      timeline[index].summary = result.summary || '';
      timeline[index].topics = result.topics || [];
      timeline[index].emotions = result.emotions || [];
      
      // 更新存储
      const stored = tt.getStorageSync('inner_events_v1') || {};
      stored.timeline = timeline;
      tt.setStorageSync('inner_events_v1', stored);
      
      // 更新界面
      this.setData({ 
        isEditing: false,
        item: timeline[index]
      });
      
      tt.hideLoading();
      tt.showToast({ title: '更新成功', icon: 'success' });
    }).catch(err => {
      console.error('分析失败:', err);
      tt.hideLoading();
      tt.showToast({ title: '分析失败，请稍后重试', icon: 'none' });
    });
  },
  
  createNewRecord(text) {
    // 创建新记录
    app.globalData.draft = { text: text };
    tt.navigateTo({ url: '/pages/analysis/index' });
  }
});