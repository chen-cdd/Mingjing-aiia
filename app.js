App({
    globalData: {
      draft: { text: "" },
      analysis: null,
      sessions: tt.getStorageSync('mj_sessions') || [],
      persons: tt.getStorageSync('mj_persons') || {},
      actions: tt.getStorageSync('mj_actions') || []
    },
    persist() {
      tt.setStorageSync('mj_sessions', this.globalData.sessions);
      tt.setStorageSync('mj_persons', this.globalData.persons);
      tt.setStorageSync('mj_actions', this.globalData.actions);
    }
  });
  