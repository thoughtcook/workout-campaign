(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./training-core'):root.Training);if(typeof module==='object'&&module.exports)module.exports=api;else root.JournalStore=api;})(globalThis,function(T){
  'use strict';
  const KEY='workout-campaign.v2';
  class Store {
    constructor(storage){this.storage=storage;this.raw=null;this.state=T.fresh();this.error=null;try{this.raw=storage.getItem(KEY);if(this.raw!==null)this.state=T.validateState(JSON.parse(this.raw));}catch(e){this.error=e;}}
    save(next){if(this.error)throw new Error('本机记录读取异常，已停止写入以保护原数据。请导出原始备份。');if(this.storage.getItem(KEY)!==this.raw)throw new Error('另一页面更新了记录。请先导出当前备份，再刷新页面；本次未覆盖数据。');const validated=T.validateState(next);const raw=JSON.stringify(validated);this.storage.setItem(KEY,raw);this.raw=raw;this.state=validated;return this.state;}
    change(fn){const next=T.clone(this.state);fn(next);return this.save(next);}
  }
  return {KEY,Store};
});
