const app = getApp();
Page({
  data:{ text:'' },
  onInput(e){ this.setData({ text: e.detail.value }); },
  save(){
    const t = this.data.text.trim();
    if(!t){ tt.showToast({ title:'先写点内容吧', icon:'none' }); return; }
    app.globalData.draft = { text: t };
    tt.navigateTo({ url:'/pages/analysis/index' });
  }
});
