const app = getApp();
let timer=null, phase=0, t=0, totalCycles=0;

Page({
  data:{ 
    running:false, 
    cue:'跟我一起：吸气 4 拍', 
    scale:1,
    progress:0,
    currentPhase:'准备',
    cycleCount:0,
    beforeMood:50,
    afterMood:50,
    breathPattern:[4,7,8] // 可自定义的呼吸节拍
  },
  
  onLoad(){
    // 页面加载时初始化
    this.setData({ 
      cue: `准备开始 ${this.data.breathPattern[0]}-${this.data.breathPattern[1]}-${this.data.breathPattern[2]} 呼吸练习`,
      currentPhase: '准备'
    });
  },
  
  onUnload(){
    // 页面卸载时清理定时器
    if(timer) {
      clearInterval(timer);
      timer = null;
    }
  },
  
  toggle(){
    if(this.data.running){ 
      this.stopBreathing();
      return; 
    }
    this.startBreathing();
  },
  
  startBreathing(){
    const [inhale, hold, exhale] = this.data.breathPattern;
    const phases=[
      {t:inhale, txt:`吸气 ${inhale} 拍`, scale:1.3, phase:'吸气'},
      {t:hold, txt:`屏息 ${hold} 拍`, scale:1.3, phase:'屏息'},
      {t:exhale, txt:`呼气 ${exhale} 拍`, scale:0.8, phase:'呼气'}
    ];
    
    phase=0; t=0; totalCycles=0;
    this.setData({ 
      running:true, 
      progress:0,
      cycleCount:0,
      currentPhase:phases[0].phase
    });
    
    timer=setInterval(()=>{
      const p=phases[phase];
      const progressInPhase = (t + 1) / p.t;
      const totalProgress = ((totalCycles * 3 + phase) * 100 + progressInPhase * 100) / 3;
      
      this.setData({ 
        cue: p.txt,
        scale: this.calculateScale(p.scale, progressInPhase),
        progress: Math.min(progressInPhase * 100, 100),
        currentPhase: p.phase
      });
      
      if(++t >= p.t){ 
        phase = (phase + 1) % 3; 
        t = 0;
        if(phase === 0) {
          totalCycles++;
          this.setData({ cycleCount: totalCycles });
        }
      }
    }, 1000);
  },
  
  stopBreathing(){
    if(timer) {
      clearInterval(timer); 
      timer = null;
    }
    this.setData({ 
      running:false, 
      scale:1, 
      progress:0,
      currentPhase:'准备',
      cue: `准备开始 ${this.data.breathPattern[0]}-${this.data.breathPattern[1]}-${this.data.breathPattern[2]} 呼吸练习`
    });
  },
  
  calculateScale(targetScale, progress){
    // 使用缓动函数使动画更平滑
    const easeInOut = t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    const easedProgress = easeInOut(progress);
    return 1 + (targetScale - 1) * easedProgress;
  },
  
  onBeforeMoodChange(e){
    this.setData({ beforeMood: e.detail.value });
  },
  
  onAfterMoodChange(e){
    this.setData({ afterMood: e.detail.value });
  },
  
  adjustBreathPattern(e){
    const type = e.currentTarget.dataset.type;
    const patterns = {
      'beginner': [3,3,3],
      'standard': [4,7,8], 
      'advanced': [6,6,6]
    };
    if(patterns[type]) {
      this.setData({ 
        breathPattern: patterns[type],
        cue: `准备开始 ${patterns[type][0]}-${patterns[type][1]}-${patterns[type][2]} 呼吸练习`
      });
    }
  },
  
  back(){ 
    this.stopBreathing();
    tt.navigateBack({ delta:1 }); 
  },
  
  save(){
    this.stopBreathing();
    
    const act = app.globalData.actions;
    const sessionData = {
      text: `完成：${this.data.breathPattern[0]}-${this.data.breathPattern[1]}-${this.data.breathPattern[2]} 呼吸练习`,
      at: new Date().toISOString(),
      cycles: this.data.cycleCount,
      beforeMood: this.data.beforeMood,
      afterMood: this.data.afterMood,
      improvement: this.data.afterMood - this.data.beforeMood
    };
    
    act.unshift(sessionData);
    app.globalData.actions = act; 
    app.persist();
    
    const improvementText = sessionData.improvement > 0 ? 
      `心情提升了${sessionData.improvement}分！` : 
      sessionData.improvement < 0 ? 
      `继续练习会更好` : 
      `保持良好状态`;
    
    tt.showToast({ 
      title: `已归档 - ${improvementText}`, 
      icon: 'none',
      duration: 2000
    });
    
    setTimeout(() => {
      tt.navigateBack({ delta:1 });
    }, 2000);
  }
});
