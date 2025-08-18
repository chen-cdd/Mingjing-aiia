// pages/voice/index.js
const app = getApp();
const { transcribe } = require('../../utils/asr.js'); // 相对路径引入（从 pages/voice/ 回到根）

let recorder = null;
let waveTimer = null;

const OPTS_MIN = { duration: 600000 }; // 兜底：让端侧选择编码
const OPTS_AAC = { 
  format: 'aac', 
  sampleRate: 16000, 
  encodeBitRate: 48000, // 16kHz 对应 48kbps
  numberOfChannels: 1, 
  duration: 600000 
};
const OPTS_MP3 = { 
  format: 'mp3', 
  sampleRate: 16000, 
  encodeBitRate: 48000, // 16kHz 对应 48kbps
  numberOfChannels: 1, 
  duration: 600000 
};

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

    recorder.onError = (err)=>{
      this._log('recorder.onError: ' + JSON.stringify(err));
      // 记录最近一次错误时间与内容，供 _tryStartChain 判定启动是否失败
      this._lastStartErrorAt = Date.now();
      this._lastStartError = err;
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

  // —— 开始一段录音（检查权限后启动） —— //
  async _startSegment(){
    if (this._starting) return;              // 防抖
    this._starting = true;

    try{
      // 先检查当前权限状态
      const authStatus = await new Promise(resolve => {
        tt.getSetting({
          success: (res) => {
            const recordAllowed = res.authSetting?.['scope.record'];
            this._log('当前录音权限状态: ' + recordAllowed);
            resolve(recordAllowed);
          },
          fail: () => {
            this._log('获取权限状态失败');
            resolve(undefined);
          }
        });
      });

      // 权限被明确拒绝 → 引导去设置
      if (authStatus === false || this._recordDenied) {
        this._log('录音权限被拒绝 → 引导去设置');
        const r = await new Promise(resolve=>{
          tt.showModal({
            title: '需要麦克风权限',
            content: '请在设置里开启"录音"权限后再试。',
            confirmText: '去设置', cancelText: '稍后',
            success: resolve
          });
        });
        if (r?.confirm) tt.openSetting();
        return;
      }

      // 权限已授权或未请求过，尝试启动录音
      this._log('准备开始录音，权限状态: ' + (authStatus === true ? '已授权' : '未请求过，将由 start() 触发授权'));

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
              // 检查是否在开发者工具中
              const isDevTool = tt.getSystemInfoSync().platform === 'devtools';
              const message = isDevTool 
                ? '无法开始录音。如在开发者工具中调试，请先在系统设置中为抖音开发者工具开启麦克风权限。'
                : '无法开始录音，请检查设备麦克风权限。';
              tt.showToast({ title: message, icon: 'none', duration: 3000 });
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
      try{
        const beforeErrAt = this._lastStartErrorAt || 0;
        recorder.start(opts);
        // 等待一小段时间，若 onError 在此期间触发，则判定失败
        setTimeout(()=> {
          const failRecent = (this._lastStartErrorAt || 0) > beforeErrAt;
          if (failRecent) {
            this._log('start immediate fail: ' + JSON.stringify(this._lastStartError || {}));
            resolve(false);
          } else {
            resolve(true);
          }
        }, 260);
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

  // 测试百度API连接
  async testBaiduAPI(){
    this._log('开始测试百度API连接...');
    try {
      const { getBaiduAccessToken } = require('../../utils/asr.js');
      const token = await getBaiduAccessToken();
      this._log('✅ 百度API连接成功！Token: ' + token.substring(0, 20) + '...');
      tt.showToast({ title: 'API连接成功', icon: 'success' });
    } catch (error) {
      this._log('❌ 百度API连接失败: ' + error.message);
      tt.showToast({ title: 'API连接失败', icon: 'none' });
    }
  },

  // 请求录音权限
  async requestRecordPermission(){
    this._log('手动检查/引导录音权限...');
    tt.getSetting({
      success: (s) => {
        const has = s?.authSetting?.['scope.record'];
        this._log('当前权限状态 scope.record=' + has);
        if (has === true) {
          this._recordDenied = false;
          tt.showToast({ title: '已获得录音权限', icon: 'success' });
        } else if (has === false) {
          this._recordDenied = true;
          tt.showModal({
            title: '权限被拒绝',
            content: '请在抖音设置中手动开启麦克风权限',
            confirmText: '去设置', cancelText: '稍后',
            success: (modalRes) => {
              if (modalRes.confirm) {
                tt.openSetting();
              }
            }
          });
        } else {
          // 未请求过授权：根据平台规范，应由相关 API 在用户触发时弹窗授权
          tt.showModal({
            title: '提示',
            content: '请点击“开始录音”按钮，系统会在需要时弹出麦克风授权。',
            showCancel: false,
          });
        }
      },
      fail: () => {
        tt.showToast({ title: '无法获取权限状态', icon: 'none' });
      }
    });
  },

  // —— 页面内调试日志 —— //
  _log(s){
    const line = `[${new Date().toLocaleTimeString()}] ${s}`;
    console.log('[voice]', s);
    let prev = this.data.debug || '';
    prev = (line + '\n' + prev);
    this.setData({ debug: prev.slice(0, 1200) });
  }
});
