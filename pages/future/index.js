const app = getApp();

Page({
  data: {
    persons: [],  // 所有人物
    graph: null,  // 关系图实例
    selectedPersonId: null,
    personTitle: '',
    personInfo: '',
    selectedEvents: []
  },

  onLoad() {
    // 从缓存加载人物数据
    this.loadPersonsData();
    // 初始化关系图
    this.initGraph();
  },
  
  onShow() {
    // 每次显示页面时刷新数据
    this.loadPersonsData();
    // 如果已选择人物，刷新事件列表
    if (this.data.selectedPersonId) {
      this.updateSelectedEvents();
    }
  },

  // 加载人物数据
  loadPersonsData() {
    // 从本地缓存获取数据
    const stored = tt.getStorageSync('inner_events_v1') || {};
    const timeline = stored.timeline || [];
    
    // 从时间线中提取人物信息
    const personsMap = {};
    
    // 添加自己作为核心节点
    personsMap['me'] = {
      id: 'me',
      name: '我',
      info: '我自己',
      connections: [],
      events: []
    };
    
    // 从时间线中提取人物和事件
    timeline.forEach(event => {
      // 如果事件中有人物信息，则添加到人物列表
      if (Array.isArray(event.persons) && event.persons.length > 0) {
        event.persons.forEach(personName => {
          if (!personName) return;
          
          const personId = personName.replace(/\s/g, '_');
          
          // 如果人物不存在，则创建
          if (!personsMap[personId]) {
            personsMap[personId] = {
              id: personId,
              name: personName,
              info: `与 ${personName} 相关的记录`,
              connections: ['me'],  // 默认与自己相连
              events: []
            };
            
            // 将自己与该人物相连
            personsMap['me'].connections.push(personId);
          }
          
          // 将事件添加到该人物的事件列表
          personsMap[personId].events.push(event);
          
          // 同时也添加到自己的事件列表
          if (!personsMap['me'].events.includes(event)) {
            personsMap['me'].events.push(event);
          }
        });
      }
    });
    
    // 转换为数组
    const persons = Object.values(personsMap);
    
    this.setData({ persons });
    
    // 如果没有选中的人物，默认选择自己
    if (!this.data.selectedPersonId && persons.length > 0) {
      this.selectPerson('me');
    }
  },
  
  // 初始化关系图
  initGraph() {
    const ctx = tt.createCanvasContext('graph');
    
    // 简单绘制关系图
    this.drawGraph(ctx);
  },
  
  // 绘制关系图
  drawGraph(ctx) {
    const persons = this.data.persons;
    if (!persons || persons.length === 0) return;
    
    const canvasWidth = 300;  // 假设宽度为300px
    const canvasHeight = 200; // 假设高度为200px
    
    // 清空画布
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    // 计算节点位置
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
    const radius = Math.min(centerX, centerY) - 30;
    
    // 绘制自己的节点（中心）
    ctx.beginPath();
    ctx.arc(centerX, centerY, 20, 0, 2 * Math.PI);
    ctx.fillStyle = '#4a90e2';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('我', centerX, centerY);
    
    // 绘制其他人物节点
    const otherPersons = persons.filter(p => p.id !== 'me');
    const angleStep = (2 * Math.PI) / Math.max(otherPersons.length, 1);
    
    otherPersons.forEach((person, index) => {
      const angle = index * angleStep;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      
      // 绘制连接线
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(x, y);
      ctx.strokeStyle = '#cccccc';
      ctx.stroke();
      
      // 绘制节点
      ctx.beginPath();
      ctx.arc(x, y, 15, 0, 2 * Math.PI);
      ctx.fillStyle = '#50e3c2';
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(person.name.slice(0, 2), x, y);
      
      // 存储节点位置信息（用于点击检测）
      person.position = { x, y, radius: 15 };
    });
    
    ctx.draw();
  },
  
  // 点击关系图
  tapGraph(e) {
    const { x, y } = e.detail;
    const persons = this.data.persons;
    
    // 检查是否点击了中心节点（自己）
    const centerX = 150;  // 假设宽度为300px
    const centerY = 100;  // 假设高度为200px
    
    const distToCenter = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
    if (distToCenter <= 20) {
      // 点击了自己
      this.selectPerson('me');
      return;
    }
    
    // 检查是否点击了其他节点
    for (const person of persons) {
      if (person.id === 'me' || !person.position) continue;
      
      const dist = Math.sqrt(Math.pow(x - person.position.x, 2) + Math.pow(y - person.position.y, 2));
      if (dist <= person.position.radius) {
        // 点击了该人物
        this.selectPerson(person.id);
        break;
      }
    }
  },
  
  // 选择人物
  selectPerson(personId) {
    const person = this.data.persons.find(p => p.id === personId);
    if (!person) return;
    
    this.setData({
      selectedPersonId: personId,
      personTitle: person.name,
      personInfo: person.info
    });
    
    // 更新选中人物的事件列表
    this.updateSelectedEvents();
  },
  
  // 更新选中人物的事件列表
  updateSelectedEvents() {
    const personId = this.data.selectedPersonId;
    if (!personId) return;
    
    const person = this.data.persons.find(p => p.id === personId);
    if (!person || !Array.isArray(person.events)) return;
    
    // 按时间排序（最新的在前）
    const events = [...person.events].sort((a, b) => {
      return new Date(b.createTime || b.time) - new Date(a.createTime || a.time);
    });
    
    this.setData({ selectedEvents: events });
  },
  
  // 与人物分身对话
  chatWithPerson() {
    const personId = this.data.selectedPersonId;
    if (!personId || personId === 'me') return;
    
    const person = this.data.persons.find(p => p.id === personId);
    if (!person) return;
    
    // 设置聊天上下文
    app.globalData.chatContext = {
      personId: personId,
      personName: person.name,
      events: person.events
    };
    
    // 跳转到聊天页面
    tt.navigateTo({ url: '/pages/chat/index?mode=person' });
  },
  
  // 添加新事件
  addEvent() {
    const personId = this.data.selectedPersonId;
    if (!personId) return;
    
    const person = this.data.persons.find(p => p.id === personId);
    if (!person) return;
    
    // 设置草稿信息
    app.globalData.draft = {
      text: '',
      relatedPerson: person.name
    };
    
    // 跳转到文本编辑页面
    tt.navigateTo({ url: '/pages/text/index?mode=new' });
  }
});