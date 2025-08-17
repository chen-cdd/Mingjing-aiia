const app = getApp();
let timer=null, phase=0, t=0;

Page({
  data:{ running:false, cue:'跟我一起：吸气 4 拍', scale:1 },
  toggle(){
    if(this.data.running){ clearInterval(timer); this.setData({ running:false, scale:1 }); return; }
    const phases=[{t:4,txt:'吸气 4 拍',scale:1.2},{t:7,txt:'屏息 7 拍',scale:1.2},{t:8,txt:'呼气 8 拍',scale:.85}];
    phase=0; t=0; this.setData({ running:true });
    timer=setInterval(()=>{
      const p=phases[phase];
      this.setData({ cue:'跟我一起：'+p.txt, scale:p.scale });
      if(++t>=p.t){ phase=(phase+1)%3; t=0; }
    },1000);
  },
  back(){ tt.navigateBack({ delta:1 }); },
  save(){
    const act = app.globalData.actions;
    act.unshift({ text:'完成：4-7-8 呼吸', at:new Date().toISOString() });
    app.globalData.actions = act; app.persist();
    tt.showToast({ title:'已归档', icon:'none' });
    tt.navigateBack({ delta:1 });
  }
});
