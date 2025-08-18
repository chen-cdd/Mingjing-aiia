Page({
  data: {
    cacheData: null,
    timeline: [],
    personsExtracted: []
  },

  onLoad() {
    this.loadAndAnalyzeData();
  },

  loadAndAnalyzeData() {
    // 读取缓存数据
    const stored = tt.getStorageSync('inner_events_v1') || {};
    const timeline = stored.timeline || [];
    
    console.log('调试页面 - 完整缓存数据:', stored);
    console.log('调试页面 - 时间线数据:', timeline);
    
    // 分析每个事件的人物数据
    const personsExtracted = [];
    timeline.forEach((event, index) => {
      const analysis = {
        index,
        id: event.id,
        text: event.text ? event.text.substring(0, 100) + '...' : '无文本',
        hasPersonsField: !!event.persons,
        personsFromAnalysis: event.persons || [],
        personsFromText: []
      };
      
      // 尝试从文本提取人物
      if (event.text) {
        const text = event.text;
        const personMatches = [];
        
        // 匹配"XX说"等模式
        const speakMatches = text.match(/([\u4e00-\u9fa5]{2,4})(?=说|讲|告诉|问|回答|表示)/g) || [];
        personMatches.push(...speakMatches);
        
        // 匹配常见称谓
        const titleMatches = text.match(/(同学|朋友|同事|老师|导师|室友|舍友|家长|父母|妈妈|爸爸|男友|女友|伴侣|老板|上司|客户)([\u4e00-\u9fa5]{1,3})?/g) || [];
        personMatches.push(...titleMatches);
        
        // 匹配"和XX"等模式
        const withMatches = text.match(/(?:和|跟|与)([\u4e00-\u9fa5]{2,4})/g) || [];
        personMatches.push(...withMatches.map(m => m.replace(/^(和|跟|与)/, '')));
        
        // 匹配"XX的"模式
        const possessiveMatches = text.match(/([\u4e00-\u9fa5]{2,4})的/g) || [];
        personMatches.push(...possessiveMatches.map(m => m.replace('的', '')));
        
        analysis.personsFromText = [...new Set(personMatches)].filter(name => 
          name && name !== '我' && name.length >= 2 && name.length <= 4
        );
      }
      
      personsExtracted.push(analysis);
    });
    
    this.setData({
      cacheData: stored,
      timeline,
      personsExtracted
    });
  },

  clearCache() {
    tt.showModal({
      title: '确认清空',
      content: '确定要清空所有缓存数据吗？此操作不可恢复。',
      success: (res) => {
        if (res.confirm) {
          tt.removeStorageSync('inner_events_v1');
          tt.showToast({ title: '缓存已清空', icon: 'success' });
          this.loadAndAnalyzeData();
        }
      }
    });
  },

  addTestData() {
    const testEvents = [
      {
        id: 'test_1',
        text: '今天和小明一起去看电影，小明说这部电影很好看。',
        summary: '和小明看电影',
        topics: ['娱乐', '朋友'],
        persons: ['小明'],
        emotions: [{ name: '开心', score: 0.8, pct: 80 }],
        time: new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
        createTime: new Date().toISOString()
      },
      {
        id: 'test_2',
        text: '老师布置了很多作业，同学们都在抱怨。室友小红说要熬夜完成。',
        summary: '作业太多',
        topics: ['学习', '压力'],
        persons: ['老师', '同学', '小红'],
        emotions: [{ name: '焦虑', score: 0.6, pct: 60 }],
        time: new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
        createTime: new Date().toISOString()
      }
    ];
    
    const stored = tt.getStorageSync('inner_events_v1') || {};
    const timeline = stored.timeline || [];
    
    testEvents.forEach(event => {
      timeline.unshift(event);
    });
    
    stored.timeline = timeline;
    tt.setStorageSync('inner_events_v1', stored);
    
    tt.showToast({ title: '测试数据已添加', icon: 'success' });
    this.loadAndAnalyzeData();
  },

  back() {
    tt.navigateBack();
  }
});