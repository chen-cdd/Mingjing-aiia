function analyzeText(text){
    const sentences = text.split(/[。！？\n\r]/).filter(Boolean);
    const summary = sentences.slice(0,2).join('。') || text.slice(0,50);
    const topicSeeds = ['考试','DDL','舍友','恋爱','实习','就业','家长','导师','同事','上司','分手','焦虑','边界','加班','绩效','沟通','误会','压力'];
    const topics = Array.from(new Set(topicSeeds.filter(w=> text.includes(w)))).slice(0,5);
    if (topics.length===0) topics.push('日常心事');
  
    const personSeeds = ['我','同学','朋友','父母','舍友','老师','导师','同事','上司','客户','伴侣','男友','女友'];
    const persons = Array.from(new Set(personSeeds.filter(w=> text.includes(w))));
    if (persons.length===0) persons.push('我');
  
    const emoDict = {
      '愤怒':['生气','气愤','讨厌','冲突','不公平','被冒犯'],
      '恐惧':['害怕','担心','恐惧','焦虑','紧张','慌'],
      '悲伤':['难过','伤心','失落','想哭','委屈','低落'],
      '厌恶':['恶心','排斥','反感','讨厌'],
      '惊讶':['惊讶','意外','震惊'],
      '信任':['信任','依赖','安心','安全'],
      '喜悦':['开心','高兴','快乐','兴奋','轻松'],
      '期待':['期待','盼望','希望','想要']
    };
    const emotions = Object.entries(emoDict).map(([name,keys])=>{
      const score = Math.min(100, keys.reduce((a,k)=> a+(text.split(k).length-1)*20,0));
      return { name, score };
    }).filter(e=> e.score>0).sort((a,b)=> b.score-a.score).slice(0,4);
    if (emotions.length===0) emotions.push({ name:'模糊', score:40 });
  
    const needs = text.includes('边界') ? '需要被尊重与清晰边界' : '需要被理解、被看见与确定感';
    const actions = [
      '两分钟启动：把任务切成最小动作并开始 2:00',
      '4-7-8 呼吸：吸4、停7、呼8，循环4次',
      '写一条DESC脚本：用事实+感受+诉求+结果'
    ];
    return { summary, topics, persons, emotions, needs, actions };
  }
  
  function isHighRisk(text){
    const words = ['想死','自杀','自残','刀','跳楼','结束生命','伤害他','杀','活不下去'];
    return words.some(w=> text.includes(w));
  }
  
  const SKILLS = [
    { id:'start2min', title:'两分钟启动', meta:'拖延/难开始',
      steps:['把任务切成最小动作','设定 2:00 计时','只做第一步'],
      alt:'只写下起点与下一步，并做 30 秒'
    },
    { id:'478', title:'4-7-8 呼吸', meta:'情绪过强/心悸',
      steps:['吸气 4 拍','屏息 7 拍','呼气 8 拍，循环 4 次'],
      alt:'改为 4-4-6，感觉舒服就好'
    },
    { id:'desc', title:'DESC 脚本', meta:'表达边界/沟通',
      steps:['D 描述事实','E 表达感受','S 陈述诉求','C 说明结果'],
      alt:'只写 DE，稍后补 SC'
    }
  ];
  
  module.exports = { analyzeText, isHighRisk, SKILLS };
  