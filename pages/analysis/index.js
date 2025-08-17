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
  continue(){ this.setData({ showArchive: true }); },

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
