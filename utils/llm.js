const ARK_API_BASE = 'https://ark.cn-beijing.volces.com/api/v3';
const ARK_MODEL = 'doubao-seed-1-6-thinking-250715';
const ARK_API_KEY = '8a6036e5-9997-4027-9aa3-12f0c69b3a23'; 

/** 可取消：分析用户文本 */
function analyzeCancelable(text){
  let settled = false;
  let task = null;
  const t0 = Date.now();

  const payload = {
    model: ARK_MODEL,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: buildAnalyzeMessages(text)
  };

  const promise = new Promise((resolve) => {
    task = tt.request({
      url: `${ARK_API_BASE}/chat/completions`,
      method: 'POST',
      data: payload,
      timeout: 25000,
      header: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ARK_API_KEY}`
      },
      success(res){
        if (settled) return; settled = true;
        try{
          const ms = Date.now() - t0;
          const content = res?.data?.choices?.[0]?.message?.content || '';
          const json = safeParseJSON(content);
          const norm = normalizeAnalyze(json, text);
          const usage = res?.data?.usage || {};
          norm.meta = metaFrom('ark', ms, res?.statusCode, usage);
          resolve(norm);
        }catch(e){
          const norm = fallbackAnalyze(text);
          norm.meta = metaFrom('fallback', Date.now()-t0, 0, null, 'parse_error');
          resolve(norm);
        }
      },
      fail(err){
        if (settled) return; settled = true;
        const norm = fallbackAnalyze(text);
        norm.meta = metaFrom('fallback', Date.now()-t0, 0, null, (err && err.errMsg) || 'network_fail');
        resolve(norm);
      }
    });
  });

  function cancel(){
    if (settled) return;
    settled = true;
    try{ task && task.abort && task.abort(); }catch(e){}
  }

  return { promise, cancel };
}

function buildAnalyzeMessages(text){
  const system = `
你是“明镜·分析官”，遵循：平等、尊重、内在驱动、共同进化、平静深邃。
任务：对用户叙述做客观信息抽取，仅输出 JSON，字段：
- summary: string（<=120字）
- topics: string[]（最多8个）
- persons: string[]（最多8个，不能抽取用户本身）
- emotions: {name:string, score:number in [0,1]}[]（最多8个）
- risk_score: number in [0,1]
严禁额外文本。
`.trim();

  const user = `【用户叙述】\n${text}`.trim();

  return [
    { role: 'system', content: system },
    { role: 'user', content: user }
  ];
}

function normalizeAnalyze(d = {}, raw = ''){
  const emos = Array.isArray(d.emotions) ? d.emotions : [];
  const emotions = emos.map(e => {
    const s = clamp01(Number(e.score || 0));
    return { name: e.name || e.label || '情绪', score: s, pct: Math.round(s*100) };
  });
  return {
    summary: d.summary || String(raw || '').slice(0,120),
    topics:  Array.isArray(d.topics)  ? d.topics.slice(0,8)  : [],
    persons: Array.isArray(d.persons) ? d.persons.slice(0,8) : [],
    emotions,
    risk_score: typeof d.risk_score === 'number' ? clamp01(d.risk_score) : 0
  };
}

function fallbackAnalyze(raw=''){
  const t = String(raw || '').trim();
  const short = t.slice(0, 120);
  const topics = Array.from(new Set((t.match(/#([^#\s]{1,12})/g)||[]).map(s=>s.replace('#','')))).slice(0,5);
  const emotions = [{name:'紧张',score:0.42,pct:42},{name:'难过',score:0.33,pct:33}];
  return { summary: short, topics, persons: [], emotions, risk_score: 0.1 };
}

/* -------------------------------------------------------------------------- */
/*                                  Chat 部分                                  */
/* -------------------------------------------------------------------------- */

/**
 * 可取消：聊天（一次返回 共情回复 + 客观视角 + 功能卡）
 * @param {Array<{role:'user'|'assistant'|'system'|'ai'|'obj', content?:string, text?:string}>} history
 * @param {string} tag 当前话题/情绪标签，可为空
 */
function chatCancelable(history = [], tag = ''){
  let settled = false;
  let task = null;
  const t0 = Date.now();

  const payload = {
    model: ARK_MODEL,
    temperature: 0.6,
    response_format: { type: 'json_object' },
    messages: buildChatMessages(history, tag)
  };

  const promise = new Promise((resolve) => {
    task = tt.request({
      url: `${ARK_API_BASE}/chat/completions`,
      method: 'POST',
      data: payload,
      timeout: 25000,
      header: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ARK_API_KEY}`
      },
      success(res){
        if (settled) return; settled = true;
        try{
          const ms = Date.now() - t0;
          const content = res?.data?.choices?.[0]?.message?.content || '';
          const json = safeParseJSON(content);
          const norm = normalizeChat(json);
          const usage = res?.data?.usage || {};
          norm.meta = metaFrom('ark', ms, res?.statusCode, usage);
          resolve(norm);
        }catch(e){
          const norm = fallbackChat();
          norm.meta = metaFrom('fallback', Date.now()-t0, 0, null, 'parse_error');
          resolve(norm);
        }
      },
      fail(err){
        if (settled) return; settled = true;
        const norm = fallbackChat();
        norm.meta = metaFrom('fallback', Date.now()-t0, 0, null, (err && err.errMsg) || 'network_fail');
        resolve(norm);
      }
    });
  });

  function cancel(){
    if (settled) return;
    settled = true;
    try{ task && task.abort && task.abort(); }catch(e){}
  }

  return { promise, cancel };
}

function buildChatMessages(history = [], tag = ''){
  const sys = `
你是“明镜·对话引导师”。价值观：平等、尊重、内在驱动、共同进化、平静深邃。
对话策略（严格遵守）：
1) 先从用户视角共情、认同、安慰与澄清，语气温柔具体，不评判。
2) 观察用户情绪是否缓和；在「合适契机」时，补充一小段“客观视角”，帮助看见事实与边界；不强行给结论。
3) 同时给出 1~3 个“功能卡”（skills），可在 2 分钟内执行的微练习或方法；每个包含 {id,title,meta,steps[],alt}。
4) 严格只输出 JSON，无多余文字。
`.trim();

  const userHint = tag ? `（当前话题/标签：${tag}）` : '';

  const msgs = [
    { role: 'system', content: sys },
    ...history.map(m => ({
      role: (m.role === 'ai' || m.role === 'assistant' || m.role === 'obj') ? 'assistant'
           : (m.role === 'system' ? 'system' : 'user'),
      content: m.content || m.text || ''
    })),
    {
      role: 'user',
      content: `请基于以上历史对话，输出 JSON：
{
  "reply": "先从用户视角出发的共情安抚与澄清，<=120字",
  "objective": "在合适契机才给；不合适就输出空字符串",
  "skills": [
    {"id":"string-短且唯一","title":"string","meta":"string-一句话","steps":["步骤1","步骤2","步骤3"],"alt":"string-不想做时的替代方案"}
  ]
}
${userHint}`
    }
  ];

  return msgs;
}

function normalizeChat(d = {}){
  const reply = String(d.reply || '').trim();
  const objective = String(d.objective || '').trim();
  const skills = Array.isArray(d.skills) ? d.skills.slice(0, 4).map(s => ({
    id: s.id || (s.title || 'skill').toLowerCase().replace(/\s+/g,'_').slice(0,24),
    title: s.title || '小练习',
    meta: s.meta || '',
    steps: Array.isArray(s.steps) ? s.steps.slice(0, 6) : [],
    alt: s.alt || '如果现在不方便做，可以先缓一缓，喝水并做 3 次深呼吸。'
  })) : [];
  return { reply, objective, skills };
}

function fallbackChat(){
  return {
    reply: '听见你了，先缓一下，我们可以一条条理清。可以说说此刻最让你难受的点吗？',
    objective: '',
    skills: [
      { id:'box_breath', title:'方块呼吸', meta:'2分钟呼吸节律', steps:['吸气4拍','停4拍','呼气4拍','停4拍，循环8次'], alt:'不想做时，先喝水，再做 3 次深呼吸' }
    ]
  };
}

/* -------------------------------------------------------------------------- */
/*                                  工具函数                                   */
/* -------------------------------------------------------------------------- */

function metaFrom(from, ms, statusCode, usage, error){
  const m = {
    from, ms, status: statusCode || 0,
    model: ARK_MODEL,
    tokens: {
      prompt: usage?.prompt_tokens || 0,
      completion: usage?.completion_tokens || 0,
      total: usage?.total_tokens || 0
    }
  };
  if (error) m.error = error;
  return m;
}

function safeParseJSON(s){
  if (!s) return {};
  if (typeof s === 'object') return s;
  // 处理可能的 ```json 包裹
  const trimmed = String(s).trim().replace(/^```json|^```/,'').replace(/```$/,'').trim();
  try{ return JSON.parse(trimmed); }catch(e){ return {}; }
}

function clamp01(x){ return Math.max(0, Math.min(1, Number(x || 0))); }

module.exports = { analyzeCancelable, chatCancelable };
