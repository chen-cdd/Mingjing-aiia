// /pages/inner/index.js
let ctx, canvasW = 0, canvasH = 0; // 使用 CSS 像素尺寸
let nodePos = []; // {id,name,x,y,r}

const STORAGE_KEY = 'inner_events_v1';

Page({
  data:{
    tab:'today',

    /* 过去：云图 + 时间线 */
    cloud: [
      { name:'平静', scale:1.0 },
      { name:'焦虑', scale:1.24 },
      { name:'期待', scale:1.12 },
      { name:'疲惫', scale:1.18 },
      { name:'愉悦', scale:1.06 },
      { name:'沮丧', scale:1.16 }
    ],
    timeline: [
      { id:'t1', time:'今天 09:20', summary:'与同事对齐方案，略紧张但顺利推进。', topics:['工作','沟通'] },
      { id:'t2', time:'昨天 21:05', summary:'和家人通话后心里更踏实。', topics:['家庭','联结'] }
    ],

    /* 今天：技能卡 + 微行动 */
    skills: [
      { id:'box_breath', title:'方块呼吸', meta:'2 分钟节律' },
      { id:'label_emotion', title:'情绪标注', meta:'命名即驯化' },
      { id:'tiny_action', title:'三件小事', meta:'把事变小' }
    ],
    actions: [
      { at: 'a1', text: '喝一杯温水并做 3 次深呼吸', time:'随时' },
      { at: 'a2', text: '写下此刻最想感谢的人', time:'午休前' }
    ],

    /* 未来：关系图 + 事件 */
    personTitle: '人物详情',
    personInfo: '点击关系图中的节点，查看人物详情与相关事件…',
    selectedPersonId: '',
    selectedEvents: [],

    graph: {
      center: { id:'me', name:'自己', note:'关照自己的节律与界限' },
      nodes: [
        { id:'n1', name:'同事A', rel:'合作', note:'沟通偏快，逻辑强' },
        { id:'n2', name:'同事B', rel:'协作', note:'需要更多背景信息' },
        { id:'n3', name:'朋友C', rel:'支持', note:'周末徒步伙伴' },
        { id:'n4', name:'家人',   rel:'亲密', note:'每周固定通话' },
        { id:'n5', name:'导师D', rel:'指导', note:'提供职业建议' },
        { id:'n6', name:'客户E', rel:'服务', note:'对时间敏感' }
      ],
      links: [
        { from:'me', to:'n1' },{ from:'me', to:'n2' },{ from:'me', to:'n3' },
        { from:'me', to:'n4' },{ from:'me', to:'n5' },{ from:'me', to:'n6' }
      ]
    },

    // 事件编辑弹层
    showEditor:false,
    editor:{ id:'', personId:'', time:'', summary:'', topicsText:'', isNew:true }
  },

  /* ==================== 生命周期 ==================== */
  onLoad(){
    this._ensureEventsStorage();
  },
  onReady(){
    if (this.data.tab === 'future') this.drawGraph();
  },

  /* ==================== 底部导航 ==================== */
  switchTab(e){
    const tab = e.currentTarget.dataset.tab || 'today';
    this.setData({ tab }, ()=>{
      if (tab === 'future') this.drawGraph();
    });
  },
  toPast(){ this.switchTab({currentTarget:{dataset:{tab:'past'}}}); },
  toToday(){ this.switchTab({currentTarget:{dataset:{tab:'today'}}}); },
  toFuture(){ this.switchTab({currentTarget:{dataset:{tab:'future'}}}); },

  /* ==================== 今天：练习入口 ==================== */
  practice(e){
    const id = e.currentTarget.dataset.id;
    tt.navigateTo({ url: '/pages/chat/index?skill=' + id });
  },

  /* ==================== 未来：关系图（老版 Canvas 上下文） ==================== */
  drawGraph(){
    const query = tt.createSelectorQuery();
    query.select('#graph').boundingClientRect();
    query.exec(res=>{
      const rect = res && res[0]; if (!rect) return;

      // 对应 <canvas canvas-id="graph">（不要写 type="2d"）
      ctx = tt.createCanvasContext('graph');

      // 记录 CSS 像素尺寸（不做 DPR scale）
      canvasW = rect.width;
      canvasH = rect.height;

      this._renderGraph();
    });
  },

  _renderGraph(){
    const { center, nodes, links } = this.data.graph;
    if (!ctx) return;

    // 清屏
    ctx.setFillStyle('#ffffff');
    ctx.fillRect(0,0, canvasW, canvasH);

    const w = canvasW, h = canvasH;
    const cx = w/2, cy = h/2;
    const radius = Math.min(w,h)*0.34;

    // 位置
    nodePos = [];
    nodePos.push({ id:center.id, name:center.name, x:cx, y:cy, r:28 });

    const n = nodes.length;
    for (let i=0;i<n;i++){
      const ang = (Math.PI*2) * (i/n) - Math.PI/2;
      const x = cx + radius * Math.cos(ang);
      const y = cy + radius * Math.sin(ang);
      nodePos.push({ id:nodes[i].id, name:nodes[i].name, x, y, r:22 });
    }

    // 连线
    ctx.setStrokeStyle('#c7d2fe');
    ctx.setLineWidth(2);
    links.forEach(l=>{
      const a = nodePos.find(p=>p.id===l.from), b = nodePos.find(p=>p.id===l.to);
      if (!a || !b) return;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    });

    // 节点（老版上下文不支持圆形渐变，使用纯色）
    nodePos.forEach((p,i)=>{
      const fill = (i===0) ? '#60a5fa' : '#818cf8';
      ctx.setFillStyle(fill);
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();

      ctx.setStrokeStyle('#ffffff');
      ctx.setLineWidth(2);
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.stroke();

      ctx.setFillStyle('#0f172a');
      ctx.setFontSize(12);
      ctx.setTextAlign('center');
      ctx.setTextBaseline('middle');
      ctx.fillText(p.name, p.x, p.y);
    });

    ctx.draw();
  },

  tapGraph(e){
    const x = e.detail.x, y = e.detail.y; // CSS 像素
    const hit = nodePos.find(p=> (x-p.x)*(x-p.x) + (y-p.y)*(y-p.y) <= p.r*p.r );
    if (!hit) return;

    this.data.selectedPersonId = hit.id;
    const info = this._getPersonInfo(hit.id);
    const personTitle = `人物详情 · ${info.name}`;
    const personInfo = (hit.id === 'me')
      ? `自己\n— ${this.data.graph.center.note || '关照自己的节律与界限，是一切关系的起点。'}`
      : `${info.name}\n关系：${info.rel || '—'}\n备注：${info.note || '—'}`;

    this.setData({
      selectedPersonId: hit.id,
      personTitle,
      personInfo,
      selectedEvents: this._getEvents(hit.id)
    });
  },

  _getPersonInfo(id){
    if (id === 'me') return this.data.graph.center;
    return this.data.graph.nodes.find(n=>n.id===id) || { name:'未知' };
  },

  /* ==================== 事件：本地存储 CRUD ==================== */
  _ensureEventsStorage(){
    let store = [];
    try{ store = tt.getStorageSync(STORAGE_KEY) || []; }catch(e){ store = []; }
    if (!Array.isArray(store) || !store.length){
      store = [
        { id:'e1', personId:'n1', time:'本周二 14:00', summary:'讨论接口联调，确认了交付节奏。', topics:['工作','协作'] },
        { id:'e2', personId:'n1', time:'上周五 10:30', summary:'表达了对需求变更的担忧，对方能理解。', topics:['沟通','边界'] },
        { id:'e3', personId:'n3', time:'上周末', summary:'一起徒步，感觉被支持和看见。', topics:['朋友','联结'] },
        { id:'e4', personId:'n4', time:'周日晚', summary:'家庭通话，分享了近况。', topics:['家庭','支持'] },
        { id:'e5', personId:'n6', time:'昨天 16:20', summary:'客户反馈交付时间紧，希望我们给出备选方案。', topics:['客户','时间'] }
      ];
      try{ tt.setStorageSync(STORAGE_KEY, store); }catch(e){}
    }
    this._store = store;
  },

  _saveStore(){
    try{ tt.setStorageSync(STORAGE_KEY, this._store); }catch(e){}
    if (this.data.selectedPersonId) {
      this.setData({ selectedEvents: this._getEvents(this.data.selectedPersonId) });
    }
  },

  _getEvents(personId){
    return (this._store || []).filter(e => e.personId === personId);
  },

  /* ========== 事件编辑弹层 ========== */
  addEvent(){
    if (!this.data.selectedPersonId){
      tt.showToast({ title:'先点击上方关系图，选择一个人物', icon:'none' }); return;
    }
    this.setData({
      showEditor:true,
      editor:{ id:'', personId:this.data.selectedPersonId, time:'', summary:'', topicsText:'', isNew:true }
    });
  },

  openEditEvent(e){
    const id = e.currentTarget.dataset.id;
    const it = (this._store || []).find(x => x.id === id);
    if (!it) return;
    this.setData({
      showEditor:true,
      editor:{
        id: it.id, personId: it.personId, time: it.time, summary: it.summary,
        topicsText: (it.topics || []).map(s=>'#'+s).join(' '), isNew:false
      }
    });
  },

  onEditTime(e){ this.setData({ editor: {...this.data.editor, time: e.detail.value || '' } }); },
  onEditSummary(e){ this.setData({ editor: {...this.data.editor, summary: e.detail.value || '' } }); },
  onEditTopics(e){ this.setData({ editor: {...this.data.editor, topicsText: e.detail.value || '' } }); },

  cancelEdit(){ this.setData({ showEditor:false }); },

  saveEvent(){
    const ed = this.data.editor;
    if (!ed.personId) { tt.showToast({ title:'未选择人物', icon:'none' }); return; }
    if (!ed.time.trim() || !ed.summary.trim()){
      tt.showToast({ title:'请填写时间与概要', icon:'none' }); return;
    }
    const topics = parseTopics(ed.topicsText);

    if (ed.isNew){
      const id = 'e' + Date.now().toString(36);
      this._store.push({ id, personId: ed.personId, time: ed.time.trim(), summary: ed.summary.trim(), topics });
    } else {
      const i = (this._store || []).findIndex(x => x.id === ed.id);
      if (i >= 0) this._store[i] = { id: ed.id, personId: ed.personId, time: ed.time.trim(), summary: ed.summary.trim(), topics };
    }
    this._saveStore();
    this.setData({ showEditor:false });
    tt.showToast({ title:'已保存', icon:'success' });
  },

  deleteEvent(){
    const ed = this.data.editor;
    const i = (this._store || []).findIndex(x => x.id === ed.id);
    if (i < 0) { this.setData({ showEditor:false }); return; }
    tt.showModal({
      title:'确认删除？', content:'删除后无法恢复', confirmText:'删除', cancelText:'取消',
      success: r=>{
        if (r?.confirm){
          this._store.splice(i,1);
          this._saveStore();
          this.setData({ showEditor:false });
          tt.showToast({ title:'已删除', icon:'success' });
        }
      }
    });
  }
});

/* ==================== 小工具 ==================== */
function parseTopics(s=''){
  // 支持输入 "#工作 #沟通" 或 "工作 沟通"
  const arr = String(s||'').trim()
    .replace(/#/g,' ')
    .split(/\s+/)
    .map(x=>x.trim())
    .filter(Boolean);
  // 去重 & 截断
  const set = new Set(arr.map(x=>x.slice(0,12)));
  return Array.from(set);
}
