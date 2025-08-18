import * as echarts from '../../assets/ec-canvas/echarts'; 

const app = getApp();

let chart = null;

function initChart(canvas, width, height, dpr) {
  chart = echarts.init(canvas, null, {
    width: width,
    height: height,
    devicePixelRatio: dpr
  });
  canvas.setChart(chart);
  return chart;
}

Page({
  data: {
    // Your existing data properties
    persons: [],
    selectedPersonId: null,
    personTitle: '',
    personInfo: '',
    selectedEvents: [],
    personAvatar: '👤',
    personSubtitle: '',
    selectedPersonName: '',
    totalEvents: 0,
    showProfileModal: false,
    aiGeneratedProfile: '',
    customProfile: '',
    
    // ECharts component data
    ec: {
      lazyLoad: true // 手动初始化图表
    }
  },

  onLoad() {
    // 确保在页面加载时注册 ec-canvas 组件
    this.selectComponent = this.selectComponent || function() {};
  },

  onShow() {
    // onShow is the main trigger for loading data and refreshing the chart
    this.loadPersonsData();
  },

  loadPersonsData() {
    // This is your original data loading and processing logic
    let stored = tt.getStorageSync('inner_events_v1') || {};
    let timeline = stored.timeline || [];
    
    if (timeline.length === 0) {
      // Your logic for creating test data
      const testEvents = [
        { id: 'test_1', text: '...小明...小红...', summary: '和朋友看电影', persons: ['小明', '小红'], createTime: new Date().toISOString() },
        { id: 'test_2', text: '...老师...小红...小李...', summary: '作业压力大', persons: ['老师', '小红', '小李'], createTime: new Date().toISOString() },
        { id: 'test_3', text: '...小明...小红...小李...', summary: '朋友聚餐', persons: ['小明', '小红', '小李'], createTime: new Date().toISOString() }
      ];
      timeline = testEvents;
    }
    
    const personsMap = {};
    personsMap['me'] = { id: 'me', name: '我', info: '我自己', avatar: '🙋‍♀️', subtitle: '记录者', connections: [], events: [] };
    
    timeline.forEach(event => {
      const eventPersons = event.persons || [];
      eventPersons.forEach(personName => {
        if (!personName || personName === '我') return;
        const personId = personName.replace(/\s/g, '_');
        if (!personsMap[personId]) {
          personsMap[personId] = {
            id: personId, name: personName, info: `与 ${personName} 相关的记录`, avatar: '👤', subtitle: '朋友', connections: ['me'], events: []
          };
          personsMap['me'].connections.push(personId);
        }
        personsMap[personId].events.push(event);
        if (!personsMap['me'].events.some(e => e.id === event.id)) {
          personsMap['me'].events.push(event);
        }
      });
      for (let i = 0; i < eventPersons.length; i++) {
        for (let j = i + 1; j < eventPersons.length; j++) {
          const p1Id = eventPersons[i].replace(/\s/g, '_');
          const p2Id = eventPersons[j].replace(/\s/g, '_');
          if (p1Id !== 'me' && p2Id !== 'me' && personsMap[p1Id] && personsMap[p2Id]) {
            if (!personsMap[p1Id].connections.includes(p2Id)) personsMap[p1Id].connections.push(p2Id);
            if (!personsMap[p2Id].connections.includes(p1Id)) personsMap[p2Id].connections.push(p1Id);
          }
        }
      }
    });

    const persons = Object.values(personsMap);
    const totalEvents = timeline.length;

    this.setData({
      persons,
      totalEvents
    }, () => {
      // After data is set, render the chart
      this.renderChart();
    });

    if (!this.data.selectedPersonId && persons.length > 0) {
      this.selectPerson('me');
    }
  },

  renderChart() {
    // 延迟执行，确保组件已经渲染完成
    setTimeout(() => {
      this.selectComponent('#my-chart-dom-graph', (ecComponent) => {
        if (!ecComponent) {
          console.error('Failed to get ECharts component instance.');
          // 重试一次
          setTimeout(() => {
            this.renderChart();
          }, 500);
          return;
        }
        // 手动初始化图表
        try {
          ecComponent.init((canvas, width, height, dpr) => {
            const chart = initChart(canvas, width, height, dpr);
            this.setChartOption(chart);
            return chart;
          });
        } catch (error) {
          console.error('Chart initialization error:', error);
          tt.showToast({
            title: '图表初始化失败',
            icon: 'none'
          });
        }
      });
    }, 100);
  },

  setChartOption(chartInstance) {
    const persons = this.data.persons;

    const nodes = persons.map(p => ({
      id: p.id,
      name: p.name,
      symbolSize: p.id === 'me' ? 55 : 40,
      itemStyle: {
        color: p.id === 'me' ? '#764ba2' : '#667eea'
      }
    }));

    const links = [];
    persons.forEach(p => {
      if (p.connections) {
        p.connections.forEach(targetId => {
          if (p.id < targetId && persons.some(ps => ps.id === targetId)) {
            links.push({ source: p.id, target: targetId });
          }
        });
      }
    });

    const option = {
      tooltip: { trigger: 'item', formatter: '{b}' },
      series: [{
        type: 'graph',
        layout: 'force',
        nodes: nodes,
        links: links,
        roam: true,
        draggable: true,
        label: { show: true, position: 'bottom', color: '#333' },
        force: { repulsion: 200, edgeLength: 90 }
      }]
    };

    chartInstance.setOption(option, true);

    // 绑定点击事件
    chartInstance.off('click');
    chartInstance.on('click', (params) => {
      if (params.dataType === 'node' && params.data && params.data.id) {
        console.log('点击节点:', params.data.id);
        this.selectPerson(params.data.id);
      }
    });
  },

  // All your other functions (selectPerson, updateSelectedEvents, etc.) remain the same
  selectPerson(personId) {
    const person = this.data.persons.find(p => p.id === personId);
    if (!person) return;
    this.setData({
      selectedPersonId: personId,
      personTitle: person.name,
      personInfo: person.info,
      personAvatar: person.avatar || '👤',
      personSubtitle: person.subtitle || '',
      selectedPersonName: person.name
    });
    this.updateSelectedEvents();
  },

  updateSelectedEvents() {
    const personId = this.data.selectedPersonId;
    if (!personId) return;
    const person = this.data.persons.find(p => p.id === personId);
    if (!person || !Array.isArray(person.events)) {
      this.setData({ selectedEvents: [] });
      return;
    }
    const events = [...person.events].sort((a, b) => new Date(b.createTime || 0) - new Date(a.createTime || 0));
    this.setData({ selectedEvents: events });
  },

  // 查看事件详情
  viewEventDetail(e) {
    const event = e.currentTarget.dataset.event;
    if (!event || !event.id) {
      tt.showToast({
        title: '事件信息不完整',
        icon: 'none'
      });
      return;
    }
    // 跳转到事件详情页面
    tt.navigateTo({
      url: `/pages/text/index?eventId=${event.id}&mode=view`
    });
  },


  // 角色对话
  chatWithPerson() {
    const personId = this.data.selectedPersonId;
    if (!personId || personId === 'me') {
      tt.showToast({ title: '请选择其他人物', icon: 'none' });
      return;
    }
    const person = this.data.persons.find(p => p.id === personId);
    if (!person) return;
    tt.navigateTo({
      url: `/pages/roleChat/index?personId=${person.id}&personName=${encodeURIComponent(person.name)}`
    });
  },
  
  // 新增事件
  addEvent() {
    const personId = this.data.selectedPersonId;
    if (!personId) {
      tt.showToast({ title: '请先选择人物', icon: 'none' });
      return;
    }
    const person = this.data.persons.find(p => p.id === personId);
    if (!person) return;
    app.globalData.draft = { text: '', relatedPerson: person.name };
    tt.navigateTo({ url: '/pages/text/index?mode=new' });
  },

  viewPersonProfile() {
    if (!this.data.selectedPersonId || this.data.selectedPersonId === 'me') {
      return;
    }
    this.generateAIProfile();
    this.setData({ showProfileModal: true });
  },

  generateAIProfile() {
    const person = this.data.persons.find(p => p.id === this.data.selectedPersonId);
    if (!person) return;
    const events = person.events || [];
    let profile = `角色名称：${person.name}\n`;
    profile += `基本信息：${person.info}\n\n`;
    if (events.length > 0) {
      profile += `性格特征：\n`;
      const eventTexts = events.map(e => e.text || e.summary || '').join(' ');
      if (eventTexts.includes('工作') || eventTexts.includes('项目')) {
        profile += `- 工作认真负责，善于合作\n`;
      }
      if (eventTexts.includes('电影') || eventTexts.includes('娱乐')) {
        profile += `- 热爱生活，喜欢娱乐活动\n`;
      }
      if (eventTexts.includes('运动') || eventTexts.includes('锻炼')) {
        profile += `- 注重健康，喜欢运动锻炼\n`;
      }
      if (eventTexts.includes('设计') || eventTexts.includes('创意')) {
        profile += `- 富有创意，对艺术敏感\n`;
      }
      profile += `\n共同经历：\n`;
      events.slice(0, 5).forEach((event, index) => {
        const summary = event.summary || event.text?.substring(0, 30) || '未知事件';
        const time = event.createTime || event.time || '未知时间';
        profile += `${index + 1}. ${summary} (${time})\n`;
      });
      if (events.length > 5) {
        profile += `... 还有 ${events.length - 5} 个事件\n`;
      }
      profile += `\n对话风格：基于以上经历，该角色在对话中会体现出相应的性格特点和兴趣爱好。`;
    } else {
      profile += `暂无共同经历记录，角色设定基于基本信息生成。`;
    }
    this.setData({ aiGeneratedProfile: profile });
  },

  closeProfileModal() {
    this.setData({ showProfileModal: false });
  },

  stopPropagation() {},

  onCustomProfileInput(e) {
    this.setData({ customProfile: e.detail.value });
  },

  regenerateProfile() {
    this.generateAIProfile();
    tt.showToast({ title: '已重新生成', icon: 'success' });
  },

  saveProfile() {
    tt.showToast({ title: '保存成功', icon: 'success' });
    this.closeProfileModal();
  },

  goToDebug() {
    tt.navigateTo({ url: '/pages/debug/index' });
  }
});