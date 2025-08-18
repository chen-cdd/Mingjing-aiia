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
    console.log('开始初始化情绪云图');
    
    // 检查系统信息和基础库版本
    const systemInfo = tt.getSystemInfoSync();
    console.log('系统信息:', systemInfo);
    
    const query = tt.createSelectorQuery().in(this);
    query.select('#cloud')
      .fields({ node: true, size: true })
      .exec((res) => {
        console.log('Canvas查询结果:', res);
        
        if (res && res[0]) {
          if (res[0].node) {
            // 使用新版Canvas 2D API
            try {
              const canvas = res[0].node;
              console.log('Canvas节点:', canvas);
              
              // 检查Canvas节点是否有效
              if (!canvas || typeof canvas.getContext !== 'function') {
                console.error('Canvas节点无效或不支持getContext方法');
                this.fallbackToOldCanvas();
                return;
              }
              
              const ctx = canvas.getContext('2d');
              if (!ctx) {
                console.error('无法获取2D上下文，降级到旧版API');
                this.fallbackToOldCanvas();
                return;
              }
              
              const dpr = systemInfo.pixelRatio || 1;
              const width = res[0].width || 300;
              const height = res[0].height || 300;
              
              canvas.width = width * dpr;
              canvas.height = height * dpr;
              ctx.scale(dpr, dpr);
              
              this.ctx = ctx;
              this.canvas = canvas;
              this.isNewCanvas = true;
              this.emotionPositions = [];
              
              console.log('新版Canvas初始化成功');
              this.updateEmotionCloud();
              
            } catch (error) {
              console.error('新版Canvas初始化失败:', error);
              this.fallbackToOldCanvas();
            }
          } else {
            // 没有node属性，使用旧版API
            console.log('Canvas节点不存在，使用旧版API');
            this.fallbackToOldCanvas();
          }
        } else {
          console.error('Canvas查询失败，无法初始化情绪云图');
          this.showCanvasError();
        }
      });
  },
  
  // 降级到旧版Canvas API
  fallbackToOldCanvas() {
    try {
      console.log('降级到旧版Canvas API');
      const ctx = tt.createCanvasContext('cloud', this);
      if (ctx) {
        this.ctx = ctx;
        this.isNewCanvas = false;
        this.emotionPositions = [];
        console.log('旧版Canvas初始化成功');
        this.updateEmotionCloud();
      } else {
        console.error('旧版Canvas初始化也失败');
        this.showCanvasError();
      }
    } catch (error) {
      console.error('旧版Canvas初始化失败:', error);
      this.showCanvasError();
    }
  },
  
  // 显示Canvas错误信息
  showCanvasError() {
    console.error('Canvas完全无法初始化，显示错误提示');
    tt.showToast({
      title: 'Canvas初始化失败，请重试',
      icon: 'none',
      duration: 2000
    });
  },
  
  // 更新情绪云图
  updateEmotionCloud() {
    if (!this.ctx || !this.data.cloud || this.data.cloud.length === 0) {
      console.log('无法更新情绪云图: ctx不存在或数据为空');
      return;
    }
    
    console.log('开始更新情绪云图, 数据:', this.data.cloud);
    
    const ctx = this.ctx;
    const canvasWidth = 300;
    const canvasHeight = 300;
    
    // 清空画布
    if (this.isNewCanvas) {
      // 新版Canvas API
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    } else {
      // 旧版Canvas API
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    }
    
    // 绘制背景渐变（兼容性处理）
    try {
      if (ctx.createRadialGradient) {
        const gradient = ctx.createRadialGradient(canvasWidth/2, canvasHeight/2, 0, canvasWidth/2, canvasHeight/2, canvasWidth/2);
        gradient.addColorStop(0, 'rgba(74, 144, 226, 0.05)');
        gradient.addColorStop(1, 'rgba(74, 144, 226, 0.02)');
        ctx.fillStyle = gradient;
      } else {
        // 降级方案：使用纯色背景
        ctx.fillStyle = 'rgba(74, 144, 226, 0.03)';
      }
    } catch (error) {
      console.warn('Canvas渐变不支持，使用纯色背景:', error);
      ctx.fillStyle = 'rgba(74, 144, 226, 0.03)';
    }
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
    
    // 绘制情绪词
    this.emotionPositions = []; // 重置位置信息
    
    sortedEmotions.forEach((emotion, index) => {
      const fontSize = Math.max(12, Math.min(32, 12 + emotion.score * 0.3));
      const color = colors[emotion.name] || '#666';
      
      // 计算位置（简单的圆形分布）
      const angle = (index / sortedEmotions.length) * 2 * Math.PI;
      const radius = 60 + (sortedEmotions.length - index - 1) * 20;
      const x = canvasWidth / 2 + Math.cos(angle) * radius;
      const y = canvasHeight / 2 + Math.sin(angle) * radius;
      
      // 绘制文字
      ctx.font = `${fontSize}px PingFang SC, sans-serif`;
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(emotion.name, x, y);
      
      // 存储位置信息用于点击检测
      this.emotionPositions.push({
        name: emotion.name,
        x: x - fontSize * emotion.name.length / 4,
        y: y - fontSize / 2,
        width: fontSize * emotion.name.length / 2,
        height: fontSize,
        emotion: emotion
      });
    });
    
    // 如果是旧版Canvas，需要调用draw()方法
    if (!this.isNewCanvas && ctx.draw) {
      ctx.draw();
      console.log('旧版Canvas绘制完成');
    } else {
      console.log('新版Canvas绘制完成');
    }
  },
  
  // 处理云图点击事件
  onCloudTap(e) {
    if (!this.emotionPositions || this.emotionPositions.length === 0) return;
    
    const { x, y } = e.detail;
    
    // 使用小程序API获取canvas元素信息
    const query = tt.createSelectorQuery();
    query.select('#cloud').boundingClientRect((rect) => {
      if (!rect) return;
      
      const scaleX = 300 / rect.width;
      const scaleY = 300 / rect.height;
      
      const canvasX = (x - rect.left) * scaleX;
      const canvasY = (y - rect.top) * scaleY;
      
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
    }).exec();
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