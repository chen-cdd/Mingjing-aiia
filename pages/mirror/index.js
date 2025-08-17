// 抖音小程序：镜面交互
Page({
    data:{
      currentState: 'initial',   // 'initial' | 'presence' | 'menu'
      ripples: [],
      menuAnimated: false
    },
    mirrorRect: null,
  
    onReady(){
      // 取镜面区域坐标（px）
      const q = tt.createSelectorQuery();
      q.select('#mirrorSurface').boundingClientRect();
      q.exec(res => { this.mirrorRect = res && res[0]; });
    },
  
    onInitialTouchStart(e){
      // 触点 → 水波
      let x = 0, y = 0, size = 300;
      if (this.mirrorRect && e.touches && e.touches[0]) {
        const t = e.touches[0];
        x = Math.max(0, Math.min(t.pageX - this.mirrorRect.left, this.mirrorRect.width));
        y = Math.max(0, Math.min(t.pageY - this.mirrorRect.top, this.mirrorRect.height));
        size = Math.max(this.mirrorRect.width, this.mirrorRect.height) * 0.9;
      } else {
        // 兜底：居中放水波，避免 selector 失败导致“无波纹”
        x = 320; y = 480; size = 560;
      }
      const id = Date.now();
      this.setData({ ripples: this.data.ripples.concat({ id, x, y, size }) });
      setTimeout(()=> this.setData({ ripples: this.data.ripples.filter(r => r.id !== id) }), 950);
  
      // 展示“我在”，随后进入菜单
      this.setData({ currentState: 'presence' });
      setTimeout(()=>{
        this.setData({ currentState: 'menu', menuAnimated: false });
        setTimeout(()=> this.setData({ menuAnimated: true }), 20);
      }, 1000);
    },
  
    // 关闭镜中菜单回初始
    closeMenu(){ this.setData({ currentState: 'initial', ripples: [], menuAnimated: false }); },
  
    // 跳转
    goVoice(){ tt.navigateTo({ url: '/pages/voice/index' }); },
    goText(){ tt.navigateTo({ url: '/pages/text/index' }); },
    goInnerWorld(){
      tt.switchTab({ url: '/pages/today/index' }); // ✅ 使用 switchTab 代替 navigateTo
    }
  });
  