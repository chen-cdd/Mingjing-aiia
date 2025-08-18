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
你是“明镜·分析官”。价值观：平等、尊重、内在驱动、共同进化、平静深邃。

任务：对用户叙述进行客观信息抽取，并且仅输出严格符合以下 Schema 的 JSON（不得有任何额外文本/注释/解释）：

Schema:
{
  "summary": string,                 // 不超过120字，客观复述核心事件与情绪线索，避免评价和建议
  "topics": string[],                // 0-8 个，主题关键词，中文，2-8字，去重，按重要性降序
  "persons": string[],               // 0-8 个，出现的人物称谓，不能包含用户自身（“我/自己/本人/咱们/我们”等），去重，常用称谓优先（如：父母、伴侣、同事、上司、朋友、老师、同学、客户）
  "emotions": [{"name": string, "score": number}], // 1-8 项，name 从枚举中选择，score ∈ [0,1]，保留两位小数，按 score 降序
  "risk_score": number               // ∈ [0,1]，保留两位小数
}

情绪枚举（仅从此集合中选择 name）：
["愤怒","恐惧","悲伤","厌恶","惊讶","信任","喜悦","期待","羞愧","内疚","孤独","压力"]

强约束规则：
- summary：不加入建议/安慰/评价；不出现“你/我认为”等措辞。
- topics：从叙述中抽取高频或核心议题，如“绩效”“沟通”“边界”“加班”“分手”“考试”“睡眠”等；不含标点与#。
- persons：只保留非第一人称角色，示例：“父母”“伴侣”“老板”“同事”“导师”“舍友”“朋友”“客户”“老师”“同学”等。
- emotions：依据语义综合判断；总和不必为1；若无明显情绪，输出1项 { "name":"压力", "score":0.30 }。
- risk_score：依据风险线索分级打分（仅就文本语义）：
  高(≥0.80)：明确自杀/自残/伤害他人意图或计划（包含具体方法/时间等）。
  中(0.40-0.79)：强烈绝望/“活不下去”/持续失眠伴随消极想法等，但未出现具体计划。
  低(0.10-0.39)：偶发消极、压力过大但无行动意图。
  无(0.00-0.09)：未出现风险线索。

边界条件：
- 输入很短或模糊：尽量给出 summary；其余数组可为空；emotions 至少1项。
- 任何字段不得为 null/undefined；缺省字段使用空字符串或空数组。
- 仅输出 JSON 对象，不包含多余键。

输出格式要求：
- 只输出 JSON 对象，不要使用 markdown，不要出现反引号、注释或额外解释。
- 所有分数字段统一保留两位小数（例如 0.73）。

示例（仅供理解，不要在输出中包含示例文本）：
用户叙述：我最近因为绩效和加班和老板沟通崩了，觉得很委屈也有点害怕，晚上总睡不好，但我不会做傻事。
期望输出：
{"summary":"围绕绩效与加班与上级沟通受挫，产生委屈与恐惧，并影响睡眠。",
"topics":["绩效","加班","沟通","睡眠"],
"persons":["老板","同事"],
"emotions":[
{"name":"悲伤","score":0.62},
{"name":"恐惧","score":0.48},
{"name":"压力","score":0.45}],
"risk_score":0.15}
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
  // ... existing code ...
  const sys = `
  你是“明镜·对话引导师”。价值观：平等、尊重、内在驱动、共同进化、平静深邃。
  对话目标：先让用户切实感到被理解，再于合适时机给出客观视角与可执行的小练习。
  
  # 共情强化（必须执行）：
  
  - 反映式倾听：复述用户的关键用词与情绪感受（命名情绪，如“委屈/害怕/紧张/失落/愤怒/压力”等）。
  - 具象肯定与正常化：承认其处境的合理性与不易，避免评判与宏大结论。
  - 澄清与聚焦：若信息模糊，用温柔、具体的开放式问题澄清一处关键点（仅1个）。
  - 语气：温暖、具体、简短，使用中文。
  
  # 功能卡触发规则（严格遵守）：
  
  - 定义“用户轮次”为累计的用户发言次数；你需要根据历史对话自行判断用户轮次。
  - 当用户轮次 < 3：不输出功能卡，仅做共情与澄清；skills 必须为 []，objective 设为 ""。
  - 当用户轮次 ≥ 4 且还未询问过：
    - 直接输出功能卡（skills 0–3 个）；
    - reply 先给简短的共情回应，再自然过渡到行动卡；
    - objective 可在合适时机给 1–2 句客观视角；此时可以输出 skills
  - 若用户回应“不需要/先别/等等/改天”等拒绝信号：
    - 不输出功能卡，仅继续陪伴；skills 必须为 []，objective 设为 ""
   
  # 输出要求（严格遵守）：
  严格只输出一个 JSON 对象，不含多余文本/注释/反引号/Markdown。
  Schema:
  {
    "reply": "先从用户视角出发的共情安抚与澄清，<=200字，必要时加入开放式问题或温柔的询问",
    "objective": "在合适契机才给的客观视角，1-2句；不合适则为空字符串",
    "skills": [
      {
        "id": "string-短且唯一",
        "title": "string",
        "meta": "string-一句话",
        "steps": ["步骤1","步骤2","步骤3"],
        "alt": "string-替代方案"
      }
    ]
  }
  - skills 数量 0-3；每个 steps 1-3 条；id 可用英文下划线短语。
  - 禁止在 reply 中给出明确解决方案或命令式措辞；优先稳定情绪。
`.trim();

  // 基于现有对话历史估算用户轮次，加入上下文提示（非强制字段，仅帮助模型判断时机）
  const userTurns = Array.isArray(history)
    ? history.filter(m => !(m && (m.role === 'ai' || m.role === 'assistant' || m.role === 'obj' || m.role === 'system'))).length
    : 0;

  const userHint = tag ? `（当前话题/标签：${tag}；累计用户轮次：${userTurns}）` : `（累计用户轮次：${userTurns}）`;

  const msgs = [
    { role: 'system', content: sys },
    ...history.map(m => ({
      role: (m.role === 'ai' || m.role === 'assistant' || m.role === 'obj') ? 'assistant'
           : (m.role === 'system' ? 'system' : 'user'),
      content: m.content || m.text || ''
    })),
    {
      role: 'user',
      content: `请基于以上历史对话与规则输出 JSON。${userHint}
{
  "reply": "先共情安抚并澄清一个点（<=120字，语气温柔具体），末尾可用一个开放式问题，当然也可以不用，具体看用户提出的问题",
  "objective": "仅在合适契机才给的客观视角（1-2句）；不合适则为 \\"\\"",
  "skills": [
    {"id":"string-短且唯一",
    "title":"string",
    "meta":"string-一句话",
    "steps":["步骤1","步骤2","步骤3"],
    "alt":"string-替代方案"}
  ]
}`
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
