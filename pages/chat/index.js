// pages/chat/index.js
const app = getApp();
const { chatCancelable } = require('../../utils/llm.js');

// ←←← 如镜子页路径不同，请替换
const MIRROR_URL = '/pages/mirror/index';

let cancelChat = null;
let timer = null;

/* -------------------- 最小入侵的触发控制（已改为：>3轮直接出卡） -------------------- */
// 本地冷却 & 去重（不改后端）
let LAST_CARD_TS = 0;
const COOLDOWN_MS = 1 * 60 * 1000; // 1分钟冷却
const SHOWN_SKILL_IDS = new Set();

// 计算用户轮次：非 assistant/ai/obj/system 即视为用户
function countUserTurns(history = []) {
  return Array.isArray(history)
    ? history.filter(m => m && !['assistant','ai','obj','system'].includes(m.role)).length
    : 0;
}

// 就绪度评分：保留函数以备后用（当前不作为拦截条件）
const READY_PATTERNS = [
  /怎么做|怎么办|给个步骤|能试试|我想试/i,
  /练习|小练习|步骤|行动卡|卡片/i,
  /可以帮我.*吗/i,
  /准备好了|开始吧|试试看/i,
  /好一些|缓和|冷静/i
];
const NOT_READY_PATTERNS = [/不想/i, /先别/i, /等等/i, /太难了/i, /说不清楚|不知道/i];

function computeReadyScore(history = []) {
  const text = history.map(h => h.content || h.text || '').join('\n').slice(-1200);
  let score = 0;

  READY_PATTERNS.forEach(re => { if (re.test(text)) score += 0.35; });

  const last2 = history.filter(h => h.role === 'user').slice(-2).map(h => h.content || h.text || '');
  if (last2.some(s => /怎么|如何|步骤|试试/.test(s) && /[?？]/.test(s))) score += 0.25;

  const u = history.filter(h => h.role === 'user');
  if (u.length >= 3) {
    const lenNow = (u[u.length-1].content || '').length;
    const lenPrev = (u[u.length-2].content || '').length;
    if (lenPrev > 0 && lenNow / lenPrev < 0.7) score += 0.1;
  }

  NOT_READY_PATTERNS.forEach(re => { if (re.test(text)) score -= 0.3; });

  return Math.max(0, Math.min(1, score));
}

// 后置筛选：冷却 + 去重 +（>3轮直接出卡，不再用就绪分拦截，不再做“仅保留第一步”）
function postProcessSkills(inSkills = [], history = []) {
  const now = Date.now();

  // 冷却期拦截（避免频繁弹卡）
  if (now - LAST_CARD_TS < COOLDOWN_MS) {
    console.debug('skill-filter: blocked by cooldown, left(ms)=', COOLDOWN_MS - (now - LAST_CARD_TS));
    return [];
  }

  // 轮次门槛：用户轮次 < 4 时不出卡（与“>3轮直接给”对齐）
  const userTurns = countUserTurns(history);
  if (userTurns < 4) {
    console.debug('skill-filter: blocked by userTurns<4, userTurns=', userTurns);
    return [];
  }

  // 【变更点】：达到 4 轮后，直接允许出卡 —— 不再用就绪分拦截
  // const ready = computeReadyScore(history);
  // if (ready < 0.50) { ... }  // ← 已移除

  // 去重（基于 id/title 的小写键）
  let skills = (inSkills || []).filter(s => {
    const id = (s.id || s.title || '').toLowerCase();
    return id && !SHOWN_SKILL_IDS.has(id);
  });
  if (skills.length !== (inSkills || []).length) {
    console.debug('skill-filter: dedup removed', (inSkills || []).length - skills.length, 'skills');
  }

  // 【变更点】：不再做“微步进”裁剪步骤，直接展示完整 steps

  if (skills.length > 0) {
    LAST_CARD_TS = now;
    skills.forEach(s => SHOWN_SKILL_IDS.add((s.id || s.title).toLowerCase()));
    console.debug('skill-filter: PASS, emit', skills.map(s=>s.id||s.title));
  } else {
    console.debug('skill-filter: no skills after filter');
  }
  return skills;
}
/* -------------------- // 最小入侵控制结束 -------------------- */

Page({
  data:{
    tab:'chat',
    tag:'#与自己同在',
    msgs:[
      { id:'hi', role:'ai', text:'我一直在这里。' }
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
  toSOS(){ 
    // 直接跳转到rescue页面
    tt.navigateTo({
      url: '/pages/rescue/index'
    });
  },

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

      /* -------------------- 后置筛选出卡（>3轮直接出卡） -------------------- */
      const filteredSkills = postProcessSkills(out.skills || [], history);
      // 合并技能卡（去重）
      const skills = mergeSkills(this.data.skills, filteredSkills);
      this.setData({ msgs: next, skills, sending:false });
      
      // 仅在通过筛选后才记录 LLM 生成的练习
      if (filteredSkills.length > 0) {
        console.log('保存LLM生成的技能卡:', filteredSkills);
        this._saveGeneratedSkills(filteredSkills);
        tt.showToast({ title: `已记录${filteredSkills.length}个练习`, icon: 'success', duration: 1500 });
      }
      /* -------------------- // 新增结束 -------------------- */
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
    // 不追加任何消息，不弹 Toast —— "就返回对话就好"
  },

  // 跳转到rescue页面进行呼吸练习
  goToRescue(){
    this._stopTimer();
    tt.navigateTo({
      url: '/pages/rescue/index'
    });
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
    
    // 更新generatedSkills中对应记录的完成状态
    const generatedSkills = stored.generatedSkills || [];
    const generatedSkillIndex = generatedSkills.findIndex(s => s.id === skillId);
    if (generatedSkillIndex !== -1) {
      generatedSkills[generatedSkillIndex].completed = true;
      generatedSkills[generatedSkillIndex].completedAt = new Date().toISOString();
      generatedSkills[generatedSkillIndex].completedTime = new Date().toLocaleString('zh-CN', { 
        month: '2-digit', 
        day: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      stored.generatedSkills = generatedSkills;
    }
    
    tt.setStorageSync('inner_events_v1', stored);
  },

  // 保存LLM生成的练习内容（无论是否完成）
  _saveGeneratedSkills(skills) {
    if (!skills || skills.length === 0) return;
    
    const stored = tt.getStorageSync('inner_events_v1') || {};
    const generatedSkills = stored.generatedSkills || [];
    
    skills.forEach(skill => {
      if (!skill || !skill.title) return;
      
      const skillRecord = {
        id: skill.id || skill.title.toLowerCase().replace(/\s+/g, '_'),
        title: skill.title,
        meta: skill.meta || '练习技能',
        steps: skill.steps || [],
        generatedAt: new Date().toISOString(),
        generatedTime: new Date().toLocaleString('zh-CN', { 
          month: '2-digit', 
          day: '2-digit', 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        completed: false,
        source: 'llm_generated'
      };
      
      // 检查是否已存在相同的技能记录
      const existingIndex = generatedSkills.findIndex(s => s.id === skillRecord.id);
      if (existingIndex === -1) {
        generatedSkills.unshift(skillRecord);
      }
    });
    
    stored.generatedSkills = generatedSkills;
    tt.setStorageSync('inner_events_v1', stored);
    console.log('已保存generatedSkills到缓存:', generatedSkills);
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
