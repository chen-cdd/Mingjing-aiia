const app = getApp();
let recorder = null;
let waveTimer = null;

const OPTS_AAC = { format: 'aac', sampleRate: 16000, numberOfChannels: 1, duration: 600000 };
const OPTS_MP3 = { format: 'mp3', sampleRate: 16000, numberOfChannels: 1, duration: 600000 };
const OPTS_MIN = { duration: 600000 }; // 兜底：交给端侧选择编码

Page({
  data:{
    status: 'idle',                 // idle | recording | paused | processing
    transcript: '',
    levelBars: Array.from({length:32}).map(()=> 10),
    canFinish: false,
    debug: ''                       // 调试信息展示
  },

  onLoad(){
    if (!tt.getRecorderManager) {
      this._log('当前端不支持 getRecorderManager（请升级客户端/IDE）');
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
      this._starting = false; // 避免卡住
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
        if (this._pendingFinish) {
          this._pendingFinish = false;
          this._goAnalysis();
        }
      }
    };

    // 读取授权状态（不会弹框），便于判断是否曾拒绝
    tt.getSetting({
      success: s => {
        const has = s?.authSetting?.['scope.record'];
        this._recordDenied = has === false;
        this._log('getSetting scope.record=' + has);
      }
    });

    // 尝试默认开始第一段
    this._startSegment();
  },

  onUnload(){
    try{ recorder && recorder.stop(); }catch(e){}
    this.stopWave();
  },

  // ===== 录音主按钮 =====
  toggleRecord(){
    const s = this.data.status;
    if (s === 'processing') return; // 转写中禁止点击
    if (s === 'idle' || s === 'paused') this._startSegment();
    else if (s === 'recording') this._pauseSegment();
  },

  // ===== 开始一段录音（带降级重试） =====
  async _startSegment(){
    if (this._starting) return;   // 防抖
    this._starting = true;

    try{
      // 若曾明确拒绝，先引导去设置
      if (this._recordDenied) {
        this._log('曾拒绝麦克风权限 → 引导去设置');
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

      // 先尝试主动授权（若已授权会直接通过，未授权时可能弹系统框）
      await this._tryAuthorize();

      // 依次尝试 3 种参数，直到成功
      const ok = await this._tryStartChain([OPTS_AAC, OPTS_MP3, OPTS_MIN]);
      if (!ok) {
        this._log('所有参数都 start 失败');
        tt.showToast({ title:'无法开始录音', icon:'none' });
        this.setData({ status:'paused' });
        return;
      }

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

  // 主动授权（可选）；失败不抛错，仅记录
  _tryAuthorize(){
    return new Promise((resolve)=>{
      if (!tt.authorize) return resolve(); // 老端无此 API
      tt.authorize({
        scope: 'scope.record',
        success: ()=>{ this._log('authorize success'); resolve(); },
        fail: (e)=> { this._log('authorize fail: ' + (e && e.errMsg)); resolve(); }
      });
    });
  },

  // 依次尝试多个参数 start
  _tryStartChain(optsList){
    const tryOne = (opts)=> new Promise((resolve)=>{
      this._log('try start: ' + JSON.stringify(opts));
      let started = false;
      try{
        // 某些端支持 onStart
        recorder.onStart && recorder.onStart(()=> { started = true; this._log('onStart ok'); resolve(true); });
        recorder.start(opts);
        // 若端不触发 onStart，延时判定
        setTimeout(()=> { if (!started) resolve(true); }, 120); // 120ms 视为已开始
      }catch(e){
        this._log('start error: ' + (e && e.message || e));
        resolve(false);
      }
    });

    return new Promise(async (resolve)=>{
      for (const opts of optsList) {
        // 避免上一次触发 onError 影响下一次
        let ok = await tryOne(opts);
        if (ok) return resolve(true);
      }
      resolve(false);
    });
  },

  // 暂停（stop -> onStop -> transcribe）
  _pauseSegment(){
    try{
      this._log('pause -> stop()');
      recorder.stop();
      this.setData({ status:'processing' });
    }catch(e){
      this._log('stop error: ' + (e && e.message || e));
    }
  },

  // ===== 波形动画（模拟） =====
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

  // ===== 完成 / 清空 / 手动编辑 =====
  async finish(){
    const hasText = !!this.data.transcript.trim();
    if (!hasText && this.data.status!=='recording') {
      tt.showToast({ title:'先说点或写点内容吧', icon:'none' }); return;
    }
    if (this.data.status === 'recording') {
      this._pendingFinish = true;
      this._pauseSegment();
    } else if (this.data.status === 'processing') {
      this._pendingFinish = true;
    } else {
      this._goAnalysis();
    }
  },

  _goAnalysis(){
    app.globalData.draft = { text: this.data.transcript.trim() };
    if (!app.globalData.draft.text) {
      tt.showToast({ title:'内容为空', icon:'none' }); return;
    }
    tt.navigateTo({ url:'/pages/analysis/index' });
  },

  clearAll(){ this.setData({ transcript:'', canFinish:false }); },

  onInput(e){
    const v = (e.detail && e.detail.value) || '';
    this.setData({ transcript: v, canFinish: !!v.trim() });
  },

  // ===== 简单日志收集到页面 =====
  _log(s){
    const line = `[${new Date().toLocaleTimeString()}] ${s}`;
    console.log(line);
    let prev = this.data.debug || '';
    prev = (line + '\n' + prev);
    // 最多保留 800 字符
    this.setData({ debug: prev.slice(0, 800) });
  }
});
