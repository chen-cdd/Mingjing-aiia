// 抖音小程序：镜面交互
Page({
    data:{
      currentState: 'initial',   // 'initial' | 'presence' | 'menu'
      ripples: [],
      menuAnimated: false,
      scrollStyle: '',
      currentIndex: 0,
      displayTexts: [], // 当前显示的文字列表
      textList: [
        '愿你的心如明镜，照见内心真实',
        '让情绪自由流淌，释放心中压力',
        '每一次呼吸都是新的开始',
        '接纳当下的自己，拥抱内心平静',
        '在宁静中找到前进的力量',
        '用温柔对待自己的每个情绪',
        '心灵的成长从自我觉察开始',
        '让内心的光芒照亮前行的路',
        '在反思中发现更好的自己',
        '每个当下都值得被珍惜'
      ]
    },
    mirrorRect: null,
    textAnimationTimer: null,
    scrollAnimationTimer: null,
  
    onReady(){
      // 取镜面区域坐标（px）
      const q = tt.createSelectorQuery();
      q.select('#mirrorSurface').boundingClientRect();
      q.exec(res => { this.mirrorRect = res && res[0]; });
      
      // 初始化显示文字
      this.initDisplayTexts();
      
      // 启动文字动画循环
      this.startTextAnimation();
    },
    
    // 初始化显示文字
    initDisplayTexts() {
      const { textList } = this.data;
      const displayTexts = [];
      
      // 显示5个文字，中间的激活
      for (let i = 0; i < 5; i++) {
        const index = (this.data.currentIndex + i - 2 + textList.length) % textList.length;
        displayTexts.push({
          text: textList[index],
          active: i === 2 // 中间位置激活
        });
      }
      
      // 重置滚动样式并更新显示文字
      this.setData({
        displayTexts,
        scrollStyle: 'transform: translateY(0); transition: none;'
      });
    },
  
    onInitialTouchStart(e){
      // 停止文字动画
      this.stopTextAnimation();
      
      // 触点 → 水波
      let x = 0, y = 0, size = 300;
      if (this.mirrorRect && e.touches && e.touches[0]) {
        const t = e.touches[0];
        x = Math.max(0, Math.min(t.pageX - this.mirrorRect.left, this.mirrorRect.width));
        y = Math.max(0, Math.min(t.pageY - this.mirrorRect.top, this.mirrorRect.height));
        size = Math.max(this.mirrorRect.width, this.mirrorRect.height) * 0.9;
      } else {
        // 兜底：居中放水波，避免 selector 失败导致"无波纹"
        x = 320; y = 480; size = 560;
      }
      const id = Date.now();
      this.setData({ ripples: this.data.ripples.concat({ id, x, y, size }) });
      setTimeout(()=> this.setData({ ripples: this.data.ripples.filter(r => r.id !== id) }), 950);
  
      // 展示"我在"，随后进入菜单
      this.setData({ currentState: 'presence' });
      setTimeout(()=>{
        this.setData({ currentState: 'menu', menuAnimated: false });
        setTimeout(()=> this.setData({ menuAnimated: true }), 20);
      }, 1000);
    },
  
    // 关闭镜中菜单回初始
    closeMenu(){ 
      this.setData({ currentState: 'initial', ripples: [], menuAnimated: false });
      // 重新启动文字动画
      this.startTextAnimation();
    },

    // 启动文字轮播动画
    startTextAnimation(){
      // 确保初始化显示文字
      this.initDisplayTexts();
      
      // 设置轮播间隔 - 增加到5秒，让用户有更多时间欣赏流畅动画
      this.textAnimationTimer = setInterval(() => {
        this.scrollToNext();
      }, 5000); // 每5秒滚动一次
    },
    
    // 滚动到下一条文字
    scrollToNext() {
      const { textList } = this.data;
      
      // 设置向上滚动的样式 - 使用更流畅的缓动函数
      this.setData({
        scrollStyle: 'transform: translateY(-66rpx); transition: transform 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);'
      });
      
      // 动画结束后重置位置并更新文字
      clearTimeout(this.scrollAnimationTimer);
      this.scrollAnimationTimer = setTimeout(() => {
        // 更新当前索引
        const nextIndex = (this.data.currentIndex + 1) % textList.length;
        
        // 更新显示文字
        const displayTexts = [];
        for (let i = 0; i < 5; i++) {
          const index = (nextIndex + i - 2 + textList.length) % textList.length;
          displayTexts.push({
            text: textList[index],
            active: i === 2 // 中间位置激活
          });
        }
        
        // 重置位置并更新文字
        this.setData({
          scrollStyle: 'transform: translateY(0); transition: none;',
          displayTexts,
          currentIndex: nextIndex
        });
      }, 1200); // 与CSS过渡时间一致
    },

    // 停止文字动画
    stopTextAnimation(){
      // 清除动画定时器
      if (this.textAnimationTimer) {
        clearInterval(this.textAnimationTimer);
        this.textAnimationTimer = null;
      }
      
      if (this.scrollAnimationTimer) {
        clearTimeout(this.scrollAnimationTimer);
        this.scrollAnimationTimer = null;
      }
    },
  
    // 跳转
    goVoice(){ tt.navigateTo({ url: '/pages/voice/index' }); },
    goText(){ tt.navigateTo({ url: '/pages/text/index' }); },
    goInnerWorld(){
      tt.switchTab({ url: '/pages/today/index' }); // ✅ 使用 switchTab 代替 navigateTo
    },

    // 页面卸载时清理定时器
    onUnload(){
      this.stopTextAnimation();
      
      // 确保清理所有定时器
      if (this.textAnimationTimer) {
        clearInterval(this.textAnimationTimer);
        this.textAnimationTimer = null;
      }
      
      if (this.scrollAnimationTimer) {
        clearTimeout(this.scrollAnimationTimer);
        this.scrollAnimationTimer = null;
      }
    }
  });
  