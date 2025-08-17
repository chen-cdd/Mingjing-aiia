Page({
  data: {
    actions: [],
    skills: []
  },

  onLoad() {
    // 加载行为卡数据
    this.loadData();
  },
  
  onShow() {
    // 每次显示页面时刷新数据
    this.loadData();
  },
  
  loadData() {
    // 从全局数据获取行为卡
    const app = getApp();
    const actions = app.globalData.actions || [];
    
    // 从 inner_events_v1 获取行为卡
    const stored = tt.getStorageSync('inner_events_v1') || {};
    const storedActions = stored.actions || [];
    const storedSkills = stored.skills || [];
    
    // 合并两种来源的行为卡
    const allActions = [...actions];
    storedActions.forEach(action => {
      if (!allActions.find(a => a.at === action.at)) {
        allActions.push(action);
      }
    });
    
    // 按时间排序
    allActions.sort((a, b) => new Date(b.at) - new Date(a.at));
    
    // 从聊天中获取技能卡
    const chatSkills = [];
    allActions.forEach(action => {
      if (action.skill && !chatSkills.find(s => s.id === action.skill.id)) {
        chatSkills.push({
          id: action.skill.id || action.skill.title.toLowerCase().replace(/\s+/g, '_'),
          title: action.skill.title,
          meta: action.skill.meta || '练习技能',
          steps: action.skill.steps || []
        });
      }
    });
    
    // 合并所有技能卡
    const allSkills = [...storedSkills, ...chatSkills];
    const uniqueSkills = [];
    const skillIds = new Set();
    
    allSkills.forEach(skill => {
      const id = skill.id || skill.title.toLowerCase().replace(/\s+/g, '_');
      if (!skillIds.has(id)) {
        skillIds.add(id);
        uniqueSkills.push({
          ...skill,
          id: id
        });
      }
    });
    
    // 保存合并后的技能卡到 inner_events_v1
    stored.skills = uniqueSkills;
    tt.setStorageSync('inner_events_v1', stored);
    
    this.setData({
      actions: allActions,
      skills: uniqueSkills
    });
  },
  
  // 打开技能练习
  practice(e) {
    const id = e.currentTarget.dataset.id;
    const skill = this.data.skills.find(s => s.id === id);
    
    if (skill) {
      tt.navigateTo({
        url: '../chat/index?skill=' + encodeURIComponent(JSON.stringify(skill))
      });
    }
  },
  
  // 打开添加习惯页面
  openAddAction() {
    tt.navigateTo({
      url: '../rescue/index?mode=habit'
    });
  },
  
  // 打开编辑习惯页面
  openEditAction(e) {
    const id = e.currentTarget.dataset.id;
    tt.navigateTo({
      url: '../rescue/index?mode=habit&id=' + id
    });
  },
  
  // 删除习惯
  deleteAction(e) {
    const id = e.currentTarget.dataset.id;
    
    tt.showModal({
      title: '确认删除',
      content: '确定要删除这个习惯吗？',
      success: (res) => {
        if (res.confirm) {
          // 从全局数据和缓存中删除
          const app = getApp();
          app.globalData.actions = app.globalData.actions.filter(a => a.at !== id);
          app.persist();
          
          // 从 inner_events_v1 中删除
          const stored = tt.getStorageSync('inner_events_v1') || {};
          stored.actions = (stored.actions || []).filter(a => a.at !== id);
          tt.setStorageSync('inner_events_v1', stored);
          
          // 刷新数据
          this.loadData();
        }
      }
    });
  }
});