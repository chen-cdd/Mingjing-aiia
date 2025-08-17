// pages/voice/index.js
const app = getApp();
const { transcribe } = require('../../utils/asr.js'); // 相对路径引入（从 pages/voice/ 回到根）

let recorder = null;
let waveTimer = null;

// 三档参数：最小兜底 → AAC@16k → MP3@16k
const OPTS_MIN = { duration: 600000 }; // 兜底：让端侧选择编码
const OPTS_AAC = { format: 'aac', sampleRate: 16000, numberOfChannels: 1, duration: 600000 };
const OPTS_MP3 = { format: 'mp3', sampleRate: 16000, numberOfChannels: 1, duration: 600000 };

Page({
  data:{
    status: 'idle',                 // idle | recording | paused | processing
    transcript: '',
    levelBars: Array.from({length:32}).map(()=> 10),
    canFinish: false,
    debug: ''                       // 调试信息（显示在页面）
  },

  onLoad(){
    if (!tt.getRecorderManager) {
      this._log('当前端不支持 getRecorderManager（请升级抖音客户端/IDE）');
      tt.showToast({ title:'端不支持录音', icon:'none' });
      return;
    }

    recorder = tt.getRecorderManager();

    // 统一错误兜底
    recorder.onError = (err)=>{
      this._log('recorder.onError: ' + JSON.stringify(err));
      tt.showToast({ title:'录音异常', icon:'none' });
      this.setData({ status:'paused' });
      this.stopWave();
      this._starting = false; // 防止卡死
    };

    // 每段 stop 后：做转写并把文本追加
    recorder.onStop = async (res)=>{
      this._log('onStop file=' + (res && res.tempFilePath));
      try{
        this.setData({ status:'processing' });
        const text = await transcribe(res.tempFilePath);
        const merged = (this.data.transcript ? (this.data.transcript + '\n') : '') + (text || '');
        this.setData({ transcript: merged.trim(), canFinish: !!merged.trim() });
      }catch(e){
        this._log('transcribe fail: ' + (e && e.message || e));
        tt.showToast({ title:'转写失败', icon:'none' });
      }finally{
        this.stopWave();
        this.setData({ status:'paused' });
        if (this._pendingFinish) { this._pendingFinish = false; this._goAnalysis(); }
      }
    };

    // 读取授权状态（不会弹系统框）
    tt.getSetting({
      success: s => {
        const has = s?.authSetting?.['scope.record'];
        this._recordDenied = has === false;
        this._log('getSetting scope.record=' + has);
      }
    });

    // 👉 建议：不要自动开始，改由用户点击按钮再开始，更符合授权策略
    // this._startSegment();
  },

  onUnload(){
    try{ recorder && recorder.stop(); }catch(e){}
    this.stopWave();
  },

  // —— 主按钮：开始 / 暂停 —— //
  toggleRecord(){
    const s = this.data.status;
    if (s === 'processing') return;          // 转写中忽略点击
    if (s === 'idle' || s === 'paused') this._startSegment();
    else if (s === 'recording') this._pauseSegment();
  },

  // —— 开始一段录音（不再使用 tt.authorize；由 start 触发授权） —— //
  async _startSegment(){
    if (this._starting) return;              // 防抖
    this._starting = true;

    try{
      // 曾拒绝过权限 → 直接引导去设置
      if (this._recordDenied) {
        this._log('曾拒绝录音权限 → 引导去设置');
        const r = await new Promise(resolve=>{
          tt.showModal({
            title: '需要麦克风权限',
            content: '请在设置里开启“录音”权限后再试。',
            confirmText: '去设置', cancelText: '稍后',
            success: resolve
          });
        });
        if (r?.confirm) tt.openSetting();
        return;
      }

      // 依次尝试三组参数（由 API 自行触发系统授权弹窗）
      const ok = await this._tryStartChain([OPTS_MIN, OPTS_AAC, OPTS_MP3]);
      if (!ok) {
        this._log('所有编码参数 start 失败（可能是权限被拒或系统限制）');

        // 再查一次授权状态；若为 false，引导去设置
        tt.getSetting({
          success: s => {
            const has = s?.authSetting?.['scope.record'];
            if (has === false) {
              this._recordDenied = true;
              tt.showModal({
                title: '需要麦克风权限',
                content: '请在设置里开启“录音”权限后再试。',
                confirmText: '去设置', cancelText: '稍后',
                success: r => { if (r?.confirm) tt.openSetting(); }
              });
            } else {
              tt.showToast({ title:'无法开始录音', icon:'none' });
            }
          },
          fail: ()=> tt.showToast({ title:'无法开始录音', icon:'none' })
        });

        this.setData({ status:'paused' });
        return;
      }

      // 成功
      this.setData({ status:'recording' });
      this.startWave();

    }catch(e){
      this._log('start exception: ' + (e && e.message || e));
      tt.showToast({ title:'无法开始录音', icon:'none' });
      this.setData({ status:'paused' });
    }finally{
      this._starting = false;
    }
  },

  // 依次尝试多个参数 start
  _tryStartChain(optsList){
    const tryOne = (opts)=> new Promise((resolve)=>{
      this._log('try start: ' + JSON.stringify(opts));
      let started = false;
      try{
        // 某些端会触发 onStart
        recorder.onStart && recorder.onStart(()=> { started = true; this._log('onStart ok'); resolve(true); });
        recorder.start(opts);
        // 若端不触发 onStart，延时兜底判定
        setTimeout(()=> { if (!started) resolve(true); }, 140);
      }catch(e){
        this._log('start error: ' + (e && e.message || e));
        resolve(false);
      }
    });

    return new Promise(async (resolve)=>{
      for (const opts of optsList) {
        const ok = await tryOne(opts);
        if (ok) return resolve(true);
      }
      resolve(false);
    });
  },

  // —— 暂停（stop -> onStop -> transcribe） —— //
  _pauseSegment(){
    try{
      this._log('pause -> stop()');
      recorder.stop();
      this.setData({ status:'processing' });
    }catch(e){
      this._log('stop error: ' + (e && e.message || e));
    }
  },

  // —— 波形动画（模拟） —— //
  startWave(){
    this.stopWave();
    waveTimer = setInterval(()=>{
      if (this.data.status !== 'recording') return;
      const next = this.data.levelBars.map((_,i)=> {
        const base = 18 + Math.sin(Date.now()/120 + i)*10;
        const rand = Math.random()*40;
        return Math.max(8, Math.min(180, base + rand));
      });
      this.setData({ levelBars: next });
    }, 100);
  },
  stopWave(){ if (waveTimer){ clearInterval(waveTimer); waveTimer=null; } },

  // —— 完成 / 清空 / 手动编辑 —— //
  async finish(){
    const hasText = !!this.data.transcript.trim();
  
    // ① 正在录音：先 stop -> onStop 里会转写最后一段；转完在 finally 里根据 _pendingFinish 自动跳页
    if (this.data.status === 'recording') {
      this._pendingFinish = true;
      this._pauseSegment();
      return;
    }
  
    // ② 正在转写：立即跳转，不等接口返回（忽略最后一段的转写结果）
    if (this.data.status === 'processing') {
      this._pendingFinish = false; // 避免 onStop finally 再次触发
      app.globalData.draft = { text: this.data.transcript.trim() };
      tt.navigateTo({ url:'/pages/analysis/index' });
      return;
    }
  
    // ③ 已暂停/空内容校验
    if (!hasText) {
      tt.showToast({ title:'先说点或写点内容吧', icon:'none' });
      return;
    }
  
    // ④ 已暂停且有文本：直接跳
    this._goAnalysis();
  },
  

  _goAnalysis(){
    app.globalData.draft = { text: this.data.transcript.trim() };
    if (!app.globalData.draft.text) { tt.showToast({ title:'内容为空', icon:'none' }); return; }
    tt.navigateTo({ url:'/pages/analysis/index' });
  },

  clearAll(){ this.setData({ transcript:'', canFinish:false }); },

  onInput(e){
    const v = (e.detail && e.detail.value) || '';
    this.setData({ transcript: v, canFinish: !!v.trim() });
  },

  // —— 页面内调试日志 —— //
  _log(s){
    const line = `[${new Date().toLocaleTimeString()}] ${s}`;
    console.log(line);
    let prev = this.data.debug || '';
    prev = (line + '\n' + prev);
    this.setData({ debug: prev.slice(0, 1200) });
  }
});
