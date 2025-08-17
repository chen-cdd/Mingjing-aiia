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
    });
    
    // 初始化情绪云图
    this.initEmotionCloud();
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
    
    // 更新情绪云图
    this.updateEmotionCloud();
  },
  
  // 初始化情绪云图
  initEmotionCloud() {
    const ctx = tt.createCanvasContext('cloud');
    this.ctx = ctx;
    this.updateEmotionCloud();
  },
  
  // 更新情绪云图
  updateEmotionCloud() {
    if (!this.ctx || !this.data.cloud || this.data.cloud.length === 0) return;
    
    const ctx = this.ctx;
    const canvasWidth = 300; // 假设宽度为300px
    const canvasHeight = 300; // 假设高度为300px
    
    // 清空画布
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    // 绘制情绪云图
    const emotions = this.data.cloud;
    const colors = ['#4a90e2', '#50e3c2', '#f5a623', '#d0021b', '#9013fe', '#7ed321'];
    
    emotions.forEach((emotion, index) => {
      const fontSize = Math.max(14, Math.min(30, emotion.score / 2));
      const x = Math.random() * (canvasWidth - fontSize * emotion.name.length);
      const y = Math.random() * (canvasHeight - fontSize) + fontSize;
      
      ctx.font = `${fontSize}px sans-serif`;
      ctx.fillStyle = colors[index % colors.length];
      ctx.fillText(emotion.name, x, y);
    });
    
    ctx.draw();
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