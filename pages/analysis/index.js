// pages/analysis/index.js
const app = getApp();
const { analyzeCancelable } = require('../../utils/llm.js');

let cancelAnalyze = null;

Page({
  data:{
    loading: true,
    summary: '',
    topics: [],
    persons: [],
    emotions: [],
    showArchive: false,
    showRisk: false,
    topicChips: [],
    // 元信息展示
    sourceFrom: '',
    latencyMs: 0,
    latencyText: '',
    modelName: '',
    tokenTotal: 0
  },

  onLoad(){
    const text = app?.globalData?.draft?.text || '';
    if (!text) {
      tt.showToast({ title:'没有可分析的内容', icon:'none' });
      setTimeout(()=> tt.navigateBack({ delta: 1 }), 600);
      return;
    }
    this._runAnalyze(text);
  },

  onUnload(){
    if (cancelAnalyze) { try{ cancelAnalyze(); }catch(e){} cancelAnalyze = null; }
  },

  _runAnalyze(text){
    this.setData({ loading: true });
    const { promise, cancel } = analyzeCancelable(text);
    cancelAnalyze = cancel;

    promise.then(result=>{
      cancelAnalyze = null;

      const sourceFrom = result.meta?.from || 'unknown';
      const latencyMs  = result.meta?.ms || 0;
      const latencyText = ((latencyMs/1000).toFixed(2)) + 's';
      const modelName  = result.meta?.model || '';
      const tokenTotal = result.meta?.tokens?.total || 0;

      this.setData({
        loading: false,
        summary: result.summary || '',
        topics: result.topics || [],
        persons: result.persons || [],
        emotions: Array.isArray(result.emotions) ? result.emotions : [],
        topicChips: result.topics || [],
        // meta
        sourceFrom, latencyMs, latencyText, modelName, tokenTotal
      });

      const from = sourceFrom === 'deepseek' ? 'DeepSeek ✓' : '离线兜底';
      tt.showToast({ title: `${from} · ${latencyText}`, icon: 'none' });

      if (Number(result.risk_score || 0) >= 0.7) {
        this.setData({ showRisk: true });
      }
    }).catch(_=>{
      cancelAnalyze = null;
      this.setData({ loading:false });
      tt.showToast({ title:'分析失败', icon:'none' });
    });
  },

  // 交互
  back(){ tt.navigateBack({ delta: 1 }); },
// 在 continue 方法中添加保存到缓存的逻辑
  continue() { 
    // 保存分析结果到缓存
    const stored = tt.getStorageSync('inner_events_v1') || {};
    const timeline = stored.timeline || [];
    
    // 创建新记录
    const newRecord = {
      id: Date.now().toString(),
      time: new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
      text: app.globalData.draft.text,
      summary: this.data.summary,
      topics: this.data.topicChips,
      persons: this.data.persons,  // 保存分析出的人物信息
      emotions: this.data.emotions,
      createTime: new Date().toISOString(),
      updateTime: new Date().toISOString()
    };
    
    // 添加到时间线
    timeline.unshift(newRecord);
    stored.timeline = timeline;
    
    // 更新情绪云图数据
    const cloud = stored.cloud || [];
    this.data.emotions.forEach(emotion => {
      const existing = cloud.find(item => item.name === emotion.name);
      if (existing) {
        existing.count += 1;
        existing.value += emotion.pct / 100;
      } else {
        cloud.push({
          name: emotion.name,
          count: 1,
          value: emotion.pct / 100
        });
      }
    });
    stored.cloud = cloud;
    
    // 保存到缓存
    tt.setStorageSync('inner_events_v1', stored);
    
    // 显示归档弹层
    this.setData({ showArchive: true });
  },

  addTopic(e){
    const v = (e.detail && e.detail.value || '').trim().replace(/^#/, '');
    if (!v) return;
    const list = this.data.topicChips.slice();
    if (!list.includes(v)) list.push(v);
    this.setData({ topicChips: list });
  },

  goChat(){
    app.globalData.chatContext = {
      topics: this.data.topicChips,
      summary: this.data.summary
    };
    tt.navigateTo({ url:'/pages/chat/index' });
  },

  contact(){
    tt.showModal({
      title: '请联系可信的人',
      content: '请打给家人/朋友/同事，或当地紧急求助热线。',
      showCancel: false
    });
  },

  riskContinue(){ this.setData({ showRisk:false }); }
});
