const { analyzeCancelable } = require('../../utils/llm');

// 示例数据
const SAMPLE_DATA = {
  cloud: [
    { name: '焦虑', score: 80, pct: 80 },
    { name: '悲伤', score: 65, pct: 65 },
    { name: '恐惧', score: 50, pct: 50 },
    { name: '愤怒', score: 40, pct: 40 },
    { name: '期待', score: 30, pct: 30 },
    { name: '信任', score: 25, pct: 25 }
  ],
  timeline: [
    {
      id: 'sample1',
      time: '2023-06-15 14:30',
      summary: '今天导师对我的论文提出了很多修改意见，感到有些沮丧，但也明白这是为了让论文更完善。',
      topics: ['导师', '论文', '焦虑'],
      emotions: [
        { name: '焦虑', score: 0.75, pct: 75 },
        { name: '悲伤', score: 0.45, pct: 45 }
      ],
      content: '今天导师对我的论文提出了很多修改意见，感到有些沮丧，但也明白这是为了让论文更完善。需要调整心态，认真对待每一条修改建议，争取尽快完成修改。'
    },
    {
      id: 'sample2',
      time: '2023-06-10 20:15',
      summary: '和舍友因为卫生问题发生了一些争执，感到很委屈，但后来我们坐下来好好沟通解决了问题。',
      topics: ['舍友', '沟通', '误会'],
      emotions: [
        { name: '愤怒', score: 0.65, pct: 65 },
        { name: '悲伤', score: 0.40, pct: 40 }
      ],
      content: '和舍友因为卫生问题发生了一些争执，感到很委屈，但后来我们坐下来好好沟通解决了问题。我学会了更好地表达自己的感受和需求，而不是一味地忍让或指责。'
    },
    {
      id: 'sample3',
      time: '2023-06-05 09:45',
      summary: '收到了心仪公司的面试邀请，既兴奋又紧张，需要好好准备。',
      topics: ['就业', '实习', '焦虑'],
      emotions: [
        { name: '期待', score: 0.80, pct: 80 },
        { name: '恐惧', score: 0.60, pct: 60 }
      ],
      content: '收到了心仪公司的面试邀请，既兴奋又紧张，需要好好准备。这是我一直向往的公司，希望能够展现出最好的自己，获得这个宝贵的机会。'
    }
  ]
};

Page({
  data: {
    cloud: [],
    timeline: [],
    behaviorPattern: '',
    analyzing: false,
    useSampleData: false  // 是否使用示例数据
  },

  onLoad() {
    // 加载本地缓存或云端数据
    const stored = wx.getStorageSync('inner_events_v1') || {};
    let cloud = stored.cloud || [];
    let timeline = stored.timeline || [];
    
    // 如果没有真实数据，使用示例数据
    if (cloud.length === 0 && timeline.length === 0) {
      cloud = SAMPLE_DATA.cloud;
      timeline = SAMPLE_DATA.timeline;
      this.setData({ useSampleData: true });
    }
    
    this.setData({
      cloud: cloud,
      timeline: timeline,
      behaviorPattern: wx.getStorageSync('behavior_pattern_v1') || ''
    }, () => {
      // 数据更新后重新绘制情绪云图
      if (this.data.cloud && this.data.cloud.length > 0) {
        setTimeout(() => {
          this.initEmotionCloud();
        }, 100);
      }
    });
  },
  
  onShow() {
    // 每次显示页面时刷新数据
    const stored = wx.getStorageSync('inner_events_v1') || {};
    
    // 只有在有真实数据或未使用示例数据时才更新
    if (!this.data.useSampleData || (stored.cloud && stored.cloud.length > 0)) {
      this.setData({
        cloud: stored.cloud || [],
        timeline: stored.timeline || [],
        useSampleData: false
      });
    }
    
    // 重新初始化情绪云图
    if (this.data.cloud && this.data.cloud.length > 0) {
      // 延迟一点时间确保canvas已经渲染
      setTimeout(() => {
        this.initEmotionCloud();
      }, 200);
    }
  },
  
  onReady() {
    // 页面初次渲染完成时初始化canvas
    if (this.data.cloud && this.data.cloud.length > 0) {
      setTimeout(() => {
        this.initEmotionCloud();
      }, 100);
    }
  },
  
  // 初始化情绪云图
  initEmotionCloud() {
    const ctx = tt.createCanvasContext('cloud');
    this.ctx = ctx;
    this.emotionPositions = []; // 存储情绪词位置信息
    this.updateEmotionCloud();
  },
  
  // 更新情绪云图
  updateEmotionCloud() {
    if (!this.ctx || !this.data.cloud || this.data.cloud.length === 0) return;
    
    const ctx = this.ctx;
    const canvasWidth = 300;
    const canvasHeight = 300;
    
    // 清空画布
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    // 绘制背景渐变
    const gradient = ctx.createRadialGradient(canvasWidth/2, canvasHeight/2, 0, canvasWidth/2, canvasHeight/2, canvasWidth/2);
    gradient.addColorStop(0, 'rgba(74, 144, 226, 0.05)');
    gradient.addColorStop(1, 'rgba(74, 144, 226, 0.02)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    // 绘制情绪云图
    const emotions = this.data.cloud;
    const colors = {
      '焦虑': '#ff6b6b',
      '悲伤': '#4ecdc4', 
      '恐惧': '#45b7d1',
      '愤怒': '#f9ca24',
      '期待': '#6c5ce7',
      '信任': '#a29bfe',
      '喜悦': '#fd79a8',
      '惊讶': '#fdcb6e',
      '厌恶': '#e17055',
      '接受': '#00b894'
    };
    
    // 按分数排序，分数高的放在中心
    const sortedEmotions = emotions.sort((a, b) => b.score - a.score);
    this.emotionPositions = [];
    
    sortedEmotions.forEach((emotion, index) => {
      const fontSize = Math.max(16, Math.min(36, emotion.score / 1.5));
      const textWidth = ctx.measureText ? fontSize * emotion.name.length * 0.6 : fontSize * emotion.name.length * 0.6;
      
      let x, y, attempts = 0;
      let validPosition = false;
      
      // 使用螺旋布局算法避免重叠
      while (!validPosition && attempts < 50) {
        const angle = attempts * 0.5;
        const radius = Math.min(attempts * 8, Math.min(canvasWidth, canvasHeight) / 3);
        x = canvasWidth / 2 + radius * Math.cos(angle) - textWidth / 2;
        y = canvasHeight / 2 + radius * Math.sin(angle);
        
        // 确保在画布范围内
        x = Math.max(10, Math.min(x, canvasWidth - textWidth - 10));
        y = Math.max(fontSize + 10, Math.min(y, canvasHeight - 10));
        
        // 检查是否与已有文字重叠
        validPosition = true;
        for (let pos of this.emotionPositions) {
          const dx = Math.abs(x - pos.x);
          const dy = Math.abs(y - pos.y);
          if (dx < textWidth + pos.width + 10 && dy < fontSize + pos.height + 5) {
            validPosition = false;
            break;
          }
        }
        attempts++;
      }
      
      // 存储位置信息用于点击检测
      this.emotionPositions.push({
        x: x,
        y: y,
        width: textWidth,
        height: fontSize,
        emotion: emotion
      });
      
      // 绘制阴影效果
      ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
      ctx.shadowBlur = 3;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
      
      // 设置字体和颜色
      ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
      const color = colors[emotion.name] || '#4a90e2';
      const alpha = Math.max(0.6, emotion.score / 100);
      ctx.fillStyle = color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
      
      // 绘制文字
      ctx.fillText(emotion.name, x, y);
      
      // 重置阴影
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      
      // 绘制情绪强度指示器（小圆点）
      const dotRadius = Math.max(2, emotion.score / 20);
      ctx.beginPath();
      ctx.arc(x + textWidth + 8, y - fontSize/2, dotRadius, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
    });
    
    ctx.draw();
  },
  
  // 处理云图点击事件
  onCloudTap(e) {
    if (!this.emotionPositions || this.emotionPositions.length === 0) return;
    
    const { x, y } = e.detail;
    const canvasRect = e.currentTarget.getBoundingClientRect();
    const scaleX = 300 / canvasRect.width;
    const scaleY = 300 / canvasRect.height;
    
    const canvasX = (x - canvasRect.left) * scaleX;
    const canvasY = (y - canvasRect.top) * scaleY;
    
    // 检查点击的是哪个情绪词
    for (let pos of this.emotionPositions) {
      if (canvasX >= pos.x && canvasX <= pos.x + pos.width &&
          canvasY >= pos.y - pos.height && canvasY <= pos.y) {
        // 显示情绪详情
        tt.showModal({
          title: pos.emotion.name,
          content: `情绪强度: ${pos.emotion.score}%\n出现频率: ${pos.emotion.pct}%`,
          showCancel: false
        });
        break;
      }
    }
  },
  
  // 点击时间线项目，跳转到详情页
  onTimelineItemTap(e) {
    const id = e.currentTarget.dataset.id;
    const item = this.data.timeline.find(item => item.id === id);
    
    if (item) {
      // 将选中的项目存入缓存
      wx.setStorageSync('selected_timeline_item', item);
      
      // 跳转到详情页，传递完整内容
      wx.navigateTo({
        url: '../text/index?id=' + id + '&from=past&mode=view'
      });
    }
  },
  
  // 分析行为模式
  analyzeBehaviorPattern() {
    if (this.data.analyzing) return;
    
    // 检查是否有足够的时间线数据
    if (!this.data.timeline || this.data.timeline.length < 3) {
      wx.showToast({
        title: '需要至少3条记录才能分析',
        icon: 'none'
      });
      return;
    }
    
    this.setData({ analyzing: true });
    
    // 准备分析数据
    const timelineData = this.data.timeline.map(item => ({
      time: item.time,
      summary: item.summary,
      topics: item.topics,
      emotions: item.emotions
    }));
    
    // 构建分析请求文本
    const analysisText = `请分析以下时间线数据，总结用户的行为模式和情绪趋势，并提供改善建议：\n${JSON.stringify(timelineData)}`;
    
    // 调用LLM进行分析
    const { promise, cancel } = analyzeCancelable(analysisText);
    
    promise.then(result => {
      // 保存分析结果
      const pattern = result.summary || '未能识别明确的行为模式，请继续记录更多内容。';
      this.setData({
        behaviorPattern: pattern,
        analyzing: false
      });
      
      // 存入本地缓存
      wx.setStorageSync('behavior_pattern_v1', pattern);
      
      wx.showToast({
        title: '分析完成',
        icon: 'success'
      });
    }).catch(err => {
      console.error('分析失败:', err);
      this.setData({ analyzing: false });
      
      wx.showToast({
        title: '分析失败，请稍后重试',
        icon: 'none'
      });
    });
  }
});