const app = getApp();

Page({
  data: {
    persons: [],  // 所有人物
    graph: null,  // 关系图实例
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
    customProfile: ''
  },

  onLoad() {
    // 从缓存加载人物数据
    this.loadPersonsData();
    // 初始化关系图
    this.initGraph();
  },

  onReady() {
    setTimeout(() => {
      this.initGraph();
    }, 100);
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
      avatar: '🙋‍♀️',
      subtitle: '记录者',
      connections: [],
      events: []
    };
    
    // 从时间线中提取人物和事件
    timeline.forEach(event => {
      // 优先使用analysis页面分析出的persons数据
      let eventPersons = [];
      
      // 如果事件有analysis分析的persons数据，使用它
      if (Array.isArray(event.persons) && event.persons.length > 0) {
        eventPersons = event.persons;
      }
      // 否则尝试从事件文本中提取（兜底逻辑）
      else if (event.text) {
        // 简单的人物提取逻辑作为兜底
        const personMatches = event.text.match(/[\u4e00-\u9fa5]{2,4}(?=说|讲|告诉|问|回答|表示)/g) || [];
        eventPersons = [...new Set(personMatches)];
      }
      
      // 处理提取到的人物
      eventPersons.forEach(personName => {
        if (!personName || personName === '我') return;
        
        const personId = personName.replace(/\s/g, '_');
        
        // 如果人物不存在，则创建
        if (!personsMap[personId]) {
          personsMap[personId] = {
            id: personId,
            name: personName,
            info: `与 ${personName} 相关的记录`,
            avatar: '👤',
            subtitle: '朋友',
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
    });
    
    // 转换为数组
    const persons = Object.values(personsMap);
    const totalEvents = timeline.length;
    
    this.setData({ 
      persons,
      totalEvents
    });
    
    // 如果没有选中的人物，默认选择自己
    if (!this.data.selectedPersonId && persons.length > 0) {
      this.selectPerson('me');
    }
  },
  
  // 初始化关系图
  initGraph() {
    const query = tt.createSelectorQuery();
    query.select('#graph').boundingClientRect();
    query.exec((res) => {
      if (res[0]) {
        const canvas = tt.createCanvasContext('graph');
        this.canvas = canvas;
        this.canvasWidth = res[0].width;
        this.canvasHeight = res[0].height;
        this.drawGraph(canvas, res[0].width, res[0].height);
      }
    });
  },
  
  // 绘制关系图
  drawGraph(canvas, width, height) {
    const persons = this.data.persons;
    if (!persons || persons.length === 0) return;
    
    // 清空画布
    canvas.clearRect(0, 0, width, height);
    
    // 绘制背景渐变
    const gradient = canvas.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#667eea');
    gradient.addColorStop(0.5, '#764ba2');
    gradient.addColorStop(1, '#667eea');
    canvas.fillStyle = gradient;
    canvas.fillRect(0, 0, width, height);
    
    // 添加背景装饰点
    this.drawBackgroundDots(canvas, width, height);
    
    // 计算节点位置
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) - 50;
    
    // 为人物分配位置和颜色
    persons.forEach((person, index) => {
      if (person.id === 'me') {
        person.x = centerX;
        person.y = centerY;
        person.color = '#4a90e2';
      } else {
        const otherIndex = index - 1;
        const otherCount = persons.length - 1;
        const angle = (otherIndex * 2 * Math.PI) / Math.max(otherCount, 1);
        person.x = centerX + radius * Math.cos(angle);
        person.y = centerY + radius * Math.sin(angle);
        person.color = this.getPersonColor(index);
      }
    });
    
    // 绘制连线（带动画效果）
    this.drawConnections(canvas);
    
    // 绘制节点（带阴影和渐变）
    this.drawNodes(canvas);
    
    canvas.draw();
  },
  
  // 点击关系图
  tapGraph(e) {
    const x = e.detail.x;
    const y = e.detail.y;
    
    // 检查点击的是否为节点
    for (let person of this.data.persons) {
      const distance = Math.sqrt((x - person.x) ** 2 + (y - person.y) ** 2);
      if (distance <= 30) {
        this.selectPerson(person.id);
        // 添加点击动画效果
        this.animateNodeClick(person);
        break;
      }
    }
  },

  // 节点点击动画
  animateNodeClick(person) {
    if (!this.canvas) return;
    
    let scale = 1;
    const animate = () => {
      scale += 0.1;
      if (scale <= 1.3) {
        // 重绘图形
        this.drawGraph(this.canvas, this.canvasWidth, this.canvasHeight);
        
        // 绘制放大的节点
        const radius = 24 * scale;
        this.canvas.beginPath();
        this.canvas.arc(person.x, person.y, radius, 0, 2 * Math.PI);
        this.canvas.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        this.canvas.lineWidth = 3;
        this.canvas.stroke();
        
        this.canvas.draw();
        
        setTimeout(animate, 50);
      } else {
        // 动画结束，恢复正常
        this.drawGraph(this.canvas, this.canvasWidth, this.canvasHeight);
      }
    };
    
    animate();
  },

  // 绘制连线
  drawConnections(canvas) {
    // 绘制人物之间的连线
    this.data.persons.forEach(person => {
      if (person.connections) {
        person.connections.forEach(connectionId => {
          const targetPerson = this.data.persons.find(p => p.id === connectionId);
          if (targetPerson) {
            // 计算连线的强度（基于共同事件数量）
            const strength = this.getConnectionStrength(person.id, connectionId);
            const opacity = Math.max(0.2, Math.min(0.8, strength * 0.3));
            
            // 绘制连线阴影
            canvas.beginPath();
            canvas.moveTo(person.x + 1, person.y + 1);
            canvas.lineTo(targetPerson.x + 1, targetPerson.y + 1);
            canvas.strokeStyle = `rgba(0, 0, 0, ${opacity * 0.3})`;
            canvas.lineWidth = 3;
            canvas.stroke();
            
            // 绘制主连线
            const gradient = canvas.createLinearGradient(
              person.x, person.y,
              targetPerson.x, targetPerson.y
            );
            gradient.addColorStop(0, `rgba(255, 255, 255, ${opacity})`);
            gradient.addColorStop(0.5, `rgba(255, 255, 255, ${opacity * 1.2})`);
            gradient.addColorStop(1, `rgba(255, 255, 255, ${opacity})`);
            
            canvas.beginPath();
            canvas.moveTo(person.x, person.y);
            canvas.lineTo(targetPerson.x, targetPerson.y);
            canvas.strokeStyle = gradient;
            canvas.lineWidth = Math.max(2, strength);
            canvas.stroke();
            
            // 绘制连线上的装饰点
            if (strength > 2) {
              const midX = (person.x + targetPerson.x) / 2;
              const midY = (person.y + targetPerson.y) / 2;
              
              canvas.beginPath();
              canvas.arc(midX, midY, 3, 0, 2 * Math.PI);
              canvas.fillStyle = `rgba(255, 255, 255, ${opacity})`;
              canvas.fill();
            }
          }
        });
      }
    });
  },

  // 绘制节点
  drawNodes(canvas) {
    this.data.persons.forEach((person, index) => {
      const isSelected = person.id === this.data.selectedPersonId;
      const radius = isSelected ? 28 : 24;
      
      // 绘制节点阴影
      canvas.beginPath();
      canvas.arc(person.x + 2, person.y + 2, radius, 0, 2 * Math.PI);
      canvas.fillStyle = 'rgba(0, 0, 0, 0.2)';
      canvas.fill();
      
      // 绘制节点渐变背景
      const nodeGradient = canvas.createRadialGradient(
        person.x - 8, person.y - 8, 0,
        person.x, person.y, radius
      );
      nodeGradient.addColorStop(0, this.lightenColor(person.color, 0.3));
      nodeGradient.addColorStop(1, person.color);
      
      canvas.beginPath();
      canvas.arc(person.x, person.y, radius, 0, 2 * Math.PI);
      canvas.fillStyle = nodeGradient;
      canvas.fill();
      
      // 选中状态的光环效果
      if (isSelected) {
        canvas.beginPath();
        canvas.arc(person.x, person.y, radius + 6, 0, 2 * Math.PI);
        canvas.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        canvas.lineWidth = 2;
        canvas.stroke();
        
        canvas.beginPath();
        canvas.arc(person.x, person.y, radius + 10, 0, 2 * Math.PI);
        canvas.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        canvas.lineWidth = 1;
        canvas.stroke();
      }
      
      // 绘制节点边框
      canvas.beginPath();
      canvas.arc(person.x, person.y, radius, 0, 2 * Math.PI);
      canvas.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      canvas.lineWidth = 2;
      canvas.stroke();
      
      // 绘制人物头像emoji或首字母
      canvas.fillStyle = '#fff';
      canvas.font = `bold ${radius * 0.6}px Arial`;
      canvas.textAlign = 'center';
      canvas.textBaseline = 'middle';
      
      const displayText = person.avatar || person.name.charAt(0);
      canvas.fillText(displayText, person.x, person.y);
      
      // 绘制人物名称
      canvas.fillStyle = '#fff';
      canvas.font = 'bold 12px Arial';
      canvas.textAlign = 'center';
      canvas.textBaseline = 'top';
      
      // 添加文字阴影
      canvas.fillStyle = 'rgba(0, 0, 0, 0.5)';
      canvas.fillText(person.name, person.x + 1, person.y + radius + 9);
      
      canvas.fillStyle = '#fff';
      canvas.fillText(person.name, person.x, person.y + radius + 8);
      
      // 绘制事件数量指示器
      const eventCount = person.events ? person.events.length : 0;
      if (eventCount > 0) {
        const badgeX = person.x + radius - 8;
        const badgeY = person.y - radius + 8;
        
        // 徽章背景
        canvas.beginPath();
        canvas.arc(badgeX, badgeY, 8, 0, 2 * Math.PI);
        canvas.fillStyle = '#ff4757';
        canvas.fill();
        
        // 徽章边框
        canvas.beginPath();
        canvas.arc(badgeX, badgeY, 8, 0, 2 * Math.PI);
        canvas.strokeStyle = '#fff';
        canvas.lineWidth = 2;
        canvas.stroke();
        
        // 徽章文字
        canvas.fillStyle = '#fff';
        canvas.font = 'bold 10px Arial';
        canvas.textAlign = 'center';
        canvas.textBaseline = 'middle';
        canvas.fillText(eventCount.toString(), badgeX, badgeY);
      }
    });
  },

  // 背景装饰点
  drawBackgroundDots(canvas, width, height) {
    const dotCount = 20;
    for (let i = 0; i < dotCount; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const radius = Math.random() * 2 + 1;
      const opacity = Math.random() * 0.3 + 0.1;
      
      canvas.beginPath();
      canvas.arc(x, y, radius, 0, 2 * Math.PI);
      canvas.fillStyle = `rgba(255, 255, 255, ${opacity})`;
      canvas.fill();
    }
  },

  // 颜色加亮函数
  lightenColor(color, amount) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * amount * 100);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
      (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
      (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
  },

  // 获取连接强度
  getConnectionStrength(personId1, personId2) {
    const person1Events = this.data.persons.find(p => p.id === personId1)?.events || [];
    const person2Events = this.data.persons.find(p => p.id === personId2)?.events || [];
    
    // 计算共同事件数量
    let commonEvents = 0;
    person1Events.forEach(event1 => {
      person2Events.forEach(event2 => {
        if (event1.id === event2.id || 
            (event1.text && event2.text && event1.text.includes(event2.text.substring(0, 10)))) {
          commonEvents++;
        }
      });
    });
    
    return Math.min(5, commonEvents + 1);
  },

  // 获取人物颜色
  getPersonColor(index) {
    const colors = ['#50e3c2', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3', '#54a0ff', '#5f27cd'];
    return colors[index % colors.length];
  },
  
  // 选择人物
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
    if (!personId || personId === 'me') {
      tt.showToast({
        title: '请选择其他人物',
        icon: 'none'
      });
      return;
    }
    
    const person = this.data.persons.find(p => p.id === personId);
    if (!person) return;
    
    // 跳转到AI角色对话页面
    tt.navigateTo({
      url: `/pages/roleChat/index?personId=${person.id}&personName=${encodeURIComponent(person.name)}`
    });
  },
  
  // 添加新事件
  addEvent() {
    const personId = this.data.selectedPersonId;
    if (!personId) {
      tt.showToast({
        title: '请先选择人物',
        icon: 'none'
      });
      return;
    }
    
    const person = this.data.persons.find(p => p.id === personId);
    if (!person) return;
    
    // 设置草稿信息
    app.globalData.draft = {
      text: '',
      relatedPerson: person.name
    };
    
    // 跳转到文本编辑页面
    tt.navigateTo({ url: '/pages/text/index?mode=new' });
  },

  // 查看事件详情
  viewEventDetail(e) {
    const event = e.currentTarget.dataset.event;
    if (!event) return;
    
    tt.navigateTo({
      url: `/pages/eventDetail/index?eventId=${event.id}`
    });
  },

  // 查看角色设定
  viewPersonProfile() {
    if (!this.data.selectedPersonId || this.data.selectedPersonId === 'me') {
      return;
    }
    
    this.generateAIProfile();
    this.setData({
      showProfileModal: true
    });
  },

  // 生成AI角色设定
  generateAIProfile() {
    const person = this.data.persons.find(p => p.id === this.data.selectedPersonId);
    if (!person) return;
    
    const events = person.events || [];
    
    // 基于事件生成角色设定
    let profile = `角色名称：${person.name}\n`;
    profile += `基本信息：${person.info}\n\n`;
    
    if (events.length > 0) {
      profile += `性格特征：\n`;
      
      // 分析事件内容生成性格特征
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
    
    this.setData({
      aiGeneratedProfile: profile
    });
  },

  // 关闭角色设定弹窗
  closeProfileModal() {
    this.setData({
      showProfileModal: false
    });
  },

  // 阻止事件冒泡
  stopPropagation() {
    // 阻止点击弹窗内容时关闭弹窗
  },

  // 自定义设定输入
  onCustomProfileInput(e) {
    this.setData({
      customProfile: e.detail.value
    });
  },

  // 重新生成角色设定
  regenerateProfile() {
    this.generateAIProfile();
    tt.showToast({
      title: '已重新生成',
      icon: 'success'
    });
  },

  // 保存角色设定
  saveProfile() {
    // 这里可以保存到本地存储或服务器
    tt.showToast({
      title: '保存成功',
      icon: 'success'
    });
    
    this.closeProfileModal();
  }
});