;(function(win,doc) {
  // https://leancloud.cn/docs/leanstorage_guide-js.html
  /**
   * @k 评论原型
   *
   * 主要部分
   *  1.评论框复用 //√
   *  2.对用户输入进行转义 //√
   *  3.评论数据结构复用 //√
   *  4.异步加载样式表  // √
   *  5.Ajax  // 因为用了leancloud,所以直接用它的SDK
   *  6.留言排序可选 // ×
   *  ...
   *
   *  TODO
   *  1. 留言点赞功能 //非限定次数(删除cookie依然可以点赞)
   *  2. 基于localstorage存储网友 昵称/邮箱/网址
   *  2s. 用户登录/注册  // 要做吗?
   *  3. 验证码(后端配合)
   *  4. md5拼接邮箱生成头像 //基于avatar
   *  5.表情处理(类似新浪微博处理方式比较合理) //✘
   *  6.楼层嵌套  //类似biliili
   *  7.分页
   *  8.楼层ID处理 // normal则不需要处理, 楼层嵌套则要过滤不含有targetFloor的cid
   */

   let CONFIG = {
     dataBase:'CMT', //创建一个表名
     avatarUrl:'https://cdn.v2ex.com/gravatar/',  //默认头像 +md5(email)可做标识
     sort:false,  //默认新旧排序
     replyType: 'normal',
     cmtType:'textarea',  //div, textarea
     placeholder:"欢迎灌水",
     lsPrefix:'CMT',
     lsArr:['nick','email','link']
   }

   // 要存的数据结构
   let cmtDataObj = {
      comment: '',   // 评论内容
      nick: '游客',  //昵称
      email: '',  //用户邮箱
      link: '',  //用户主页
      ua: navigator.userAgent,
      url: win.location.pathname.replace(/index\.(html|htm)/, ''),
      captcha: 0,
      like: 0,
      dislike:0,
      targetFloor:''  //存储回复楼层的ID
   };



   // 辅助模块
   let Tool = {
     formatDate(date,bool){
       const padWithZeros = (vNumber, width) => {
         let numAsString = vNumber.toString();
         while (numAsString.length < width) {
           numAsString = '0' + numAsString;
         }
         return numAsString;
       }
       let vDay = padWithZeros(date.getDate(), 2);
       let vMonth = padWithZeros(date.getMonth() + 1, 2);
       let vYear = padWithZeros(date.getFullYear(), 2);
       if (bool) {
         let vH = date.getHours();
         let vM = date.getMinutes();
         let vS = date.getSeconds();
         function f(s){
           return (''+s).length ==1? '0'+s : s;
         }
         return `${vYear}-${vMonth}-${vDay} ${f(vH)}:${f(vM)}:${f(vS)}`;
       }else{
         return `${vYear}-${vMonth}-${vDay}`;
       }
     },
     // 格式化时间
     formatTime(date){
       let serTime = date.getTime();
       let curTime = new Date().getTime();
       let diff = curTime - serTime;
       let day = Math.floor(diff / (24 * 3600 * 1000));
       if (day === 0) {
         let remainMsFromeH = diff % (24 * 3600 * 1000);
         let hour = Math.floor(remainMsFromeH / (3600 * 1000));
         if (hour === 0) {
           let remainMsFromeM = remainMsFromeH % (3600 * 1000);
           let minute = Math.floor(remainMsFromeM / (60 * 1000));
           if (minute === 0) {
             let remainMsFromeS = remainMsFromeM % (60 * 1000)
             let second = Math.round(remainMsFromeS / 1000);
             return second + ' 秒前';
           }
           return minute + ' 分钟前';
         }
         return hour + ' 小时前';
       }
       if (day < 1) {
         return day + ' 天前';
       } else {
         return this.formatDate(date)
       }
     }
   }

   // 模板模块
   let TPL={
     mainView(){
       return `
         <div class="cmt-area cmt-postcomment">
           <div class="cmt-area-hd">
             <div class="cmt-area-tit">网友评论</div>
             <div class="cmt-count-wrap">共有<span class="cmt-count">0</span>条评论</div>
           </div>
         </div>
         <div class="cmt-content">
           <ul class="cmt-list" id="JcmtList"></ul>
         </div>
       `
     },
     cmtFormTpl(bool){ //评论框模板
        // div+contenteditable , 默认转义用户输入 ,textarea等,不会被转义,要过滤
       let con = null;
       if (CONFIG.cmtType=='div') {
         con = '<div class="cmt-main-txtarea" contenteditable id="{{cmtId}}" placeholder="'+CONFIG.placeholder+'"></div>'
       }else{
         con = '<textarea class="cmt-main-txtarea" placeholder="'+CONFIG.placeholder+'" id="{{cmtId}}"></textarea>'
       }
       let hd = null;
       if (!bool) {
          hd =`<div class="cmt-login-area">
             <input  class="cmt-login-ipt" placeholder="昵 称" id="Jnick" data-name="nick"/>
             <input  class="cmt-login-ipt" placeholder="邮 箱" id="Jemail" data-name="email"/>
             <input  class="cmt-login-ipt" placeholder="个人网站" id="Jlink" data-name="link"/>
           </div>`;
       }else{
          hd=''
       }
       return `
         <div class="cmt-area-bd">
            ${hd}
           <div class="cmt-main-txtarea-wrap">
             ${con}
           </div>
         </div>
         <div class="cmt-area-ft">
           <a  class="btn cmt-main-txtarea-sbmt-btn" data-event="{{eventType}}">{{btnTxt}}</a>
         </div>
       `
     },
     cmtItemTpl(){ //评论数据模板
       return `
         <div class="cmt-user-avatar">
           <a href="{{userCenter}}" class="user-center-link" target="_blank">
             <img class="user-avatar-img" src="{{avatarUrl}}">
           </a>
         </div>
         <div class="cmt-item-data-wrap" id="{{objectId}}" data-placeholder="{{userName}}">
           <div class="cmt-item-data-hd">
             <span class="cmt-item-data-floor">#{{floor}}</span>
             <span class="cmt-item-data-user">{{userName}}</span>
             <span class="cmt-item-data-time">{{createTime}}</span>
           </div>
           <p class="cmt-item-data">{{cmtData}}</p>
           <div class="cmt-item-data-hd-ft">
             <a class="cmt-item-reply-btn" data-event="reply" data-id="{{objectId}}">回复</a>
           </div>
           <ul class="reply-list" id="{{UlId}}">
             <!--placeholder-->
           </ul>
         </div>
     `},
   }

   // 主要逻辑
   let CMT = {
     init(configObj){
       if (!configObj.el) {
         console.log('缺少目标容器');
         return;
       }
       if (!configObj.appId) {
        console.log('请填写appId');
        return;
       }
       if (!configObj.appKey) {
        console.log('请填写appKey');
        return;
       }
       if(typeof MD5=='undefined'){
        this.MD5=function(str){return str};
       }else{
        this.MD5=MD5;
       }
       AV.init(configObj.appId, configObj.appKey);

       this.el = document.querySelector(configObj.el);
       // 渲染模板
       this.buildTpl();
       // 出所有评论
       this.renderAllCmt();
       // 绑定各种事件
       this.bindEvent();
       // 读取localstorage
       this.fetchUserInfo();
     },
     buildTpl(){
       this.generateMainView();  //主界面结构

       this.generateForm({ // 生成主评论框
         cmtId : 'JmainCmt',
         eventType: 'postCmt',
         btnTxt: '提交评论',
         callBack:(newCmtEle)=>{
           doc.querySelector('.cmt-postcomment').appendChild(newCmtEle);
         }
       });
     },
     generateReplyForm(cb){
       this.generateForm({  // 生成回复框, 初始状态隐藏
         cmtId : 'JreplyCmt',
         eventType: 'postReply',
         btnTxt: '提交回复',
         hideLoginArea:true,
         callBack:(newCmtEle)=>{
           this.replyForm =  newCmtEle.cloneNode(true);
           cb && cb();
         }
       });
     },
     generateMainView(){
       this.el.innerHTML = TPL.mainView()
     },
     generateForm(configObj){
       let div = doc.createElement('div')
       div.classList +='cmt-area-con';
       div.innerHTML = TPL.cmtFormTpl(configObj.hideLoginArea)
         .replace(/{{eventType}}/g,configObj.eventType)
         .replace(/{{btnTxt}}/g,configObj.btnTxt)
         .replace(/{{cmtId}}/g,configObj.cmtId);
       configObj.callBack && configObj.callBack(div);
     },
     getData(el,name){
       return el.getAttribute('data-'+name)
     },
     setData(el,name,val){
       el.setAttribute('data-'+name,val)
     },
     setPlaceHolder(cmtEle){
      if (CONFIG.replyType=='div') {
        // div+css下不能动态更新placeholder
        cmtEle.setAttribute('placeholder', '回复@'+this.placeholder+':')
      }else{
       cmtEle.placeholder = '回复@'+this.placeholder+':';
      }
     },
     checkInput(cmtEle){
       return CONFIG.cmtType=='div'? cmtEle.innerHTML.trim().length : cmtEle.value.trim().length;
     },
     setFocus(cmtEle){
       cmtEle.focus();
       if (CONFIG.cmtType=='div') {
         let range = win.getSelection();
         range.selectAllChildren(cmtEle);
         range.collapseToEnd();
       }
     },
     safeTxt(con){
      return con.replace(/</ig, '&lt;').replace(/>/ig, '&gt;')
     },
     getContent(cmtEle) {
       return this.getCleanText(cmtEle)
         .replace(/</ig, '&lt;')
         .replace(/>/ig, '&gt;');
     },
     randomID(prefix) {
       return prefix + Math.random().toString(32).slice(2);
     },
     stripTags: function(el, tagName) {
       let els = el.getElementsByTagName(tagName.toUpperCase());
       for (let i = 0; i < els.length; i++) {
         while (els[i].firstChild)
           els[i].parentNode.insertBefore(els[i].removeChild(els[i].firstChild), els[i]);
         els[i].parentNode.removeChild(els[i--]);
       }
     },
     getCleanText(cmtEle) {
       let ele = cmtEle;
       let clone = ele.cloneNode(true);
       let _v = null;
       if(CONFIG.cmtType=='div'){
         clone.innerHTML = this.html2txt(clone.innerHTML);
         this.stripTags(clone, '*');
         _v = clone.innerHTML.replace(/(?:\s|&nbsp;)*$/g, '');
       }else{
         clone.value = this.html2txt(clone.value);
         this.stripTags(clone, '*');
         _v = clone.value.replace(/(?:\s|&nbsp;)*$/g, '');
       }
       return _v;
     },
     html2txt(html) {
       let res = html.replace(/&nbsp;/igm, ' ')
         .replace(/(?:<br\s*\\?>)+/igm, '\n')
         .replace(/<div>(.*?)<\/div>/igm, "\n$1")
         .replace(/<p>(.*?)<\/p>/igm, "\n$1");
       return res;
     },
     clearCmt(cmtEle){
       if (CONFIG.cmtType=='div') {
         cmtEle.innerHTML = ''
       }else{
         cmtEle.value = ''
       }
     },
     renderCmt(configObj){
       let ret = configObj.ret,
         newInsert = configObj.newInsert;

       let targetFloor = ret.get('targetFloor'),
         hasTargetFloor =!!targetFloor,
         _objectId = ret.get('objectId'),  //留言id
         con = decodeURIComponent(ret.get('comment')),
         _floor = ret.cid.split('c')[1],
         // 昵称,个人网址要记得防XSS
         _email = ret.get('email'),
         _nick = this.safeTxt(ret.get('nick')),
         _link = ret.get('link'),
         _time = Tool.formatTime(ret.get('createdAt'));

       let _con = '', tpl = '',avatarUrl='';

       if (!!_email) {
        avatarUrl =CONFIG.avatarUrl+this.MD5(_email)+'?s=50&d=identicon';
       }else{
        avatarUrl = CONFIG.avatarUrl
       }

       if (hasTargetFloor) {
         _con = '<i>@'+this.cache[targetFloor].get('nick')
            +' #'+this.cache[targetFloor].cid.split('c')[1]
            +' </i>'+con;
       }else{
         _con = con;
       }

       tpl = TPL.cmtItemTpl()
         .replace(/{{objectId}}/g,_objectId)
         .replace(/{{floor}}/g,_floor)
         .replace(/{{userName}}/g,_nick)
         .replace(/{{userCenter}}/g,(!!_link?this.safeTxt(_link):'javascript:;'))
         .replace(/{{createTime}}/g,(newInsert?'刚刚':_time))
         .replace(/{{cmtData}}/g,_con)
         .replace(/{{avatarUrl}}/g,avatarUrl)

       let ele = doc.createElement('li');
       ele.classList ='cmt-item';
       ele.innerHTML = tpl;
       return ele;
     },
     getAllComments(cb){
       let query = new AV.Query(CONFIG.dataBase);
       // 根据页面URL(或者页面标题)来查找对应的评论
       query.equalTo('url', cmtDataObj['url']);
       if (CONFIG.sort) {
         query.descending('createdAt');  //从新到旧
       }else{
         query.ascending('createdAt');  //从旧到新
       }
       query.find().then((ret)=>{
         this.setCache(ret);
         this.setCmtNum();
         cb && cb(ret)
       })
     },
     setCache(ret){
       this.cache = {};
       for (var i = 0; i < ret.length; i++) {
         this.cache[ret[i].id] = ret[i];
       }
     },
     updateCache(obj){
       this.cache[obj.id] = obj;
       this._len = Object.getOwnPropertyNames(this.cache).length;
     },
     renderAllCmt(){
       this.getAllComments((ret)=>{
         if (CONFIG.replyType=='normal') {
           let fragment = doc.createDocumentFragment();

           for (let i = 0; i < ret.length; i++) {
             fragment.appendChild(this.renderCmt({
               ret:ret[i],
               newInsert:false
             }));
           }
           JcmtList.appendChild(fragment);
         }
       })
     },
     renderNewCmt(ret){
       let li = this.renderCmt({
         ret:ret,
         newInsert:true
       });

       // 判断插入位置
       function normalSort(parent){
         if (CONFIG.sort) {
           parent.prepend(li);
         }else{
           parent.appendChild(li);
         }
       }

       normalSort(JcmtList);
     },
     setCmtNum(){
       let ele = doc.querySelector('.cmt-count')
       this._len = Object.getOwnPropertyNames(this.cache).length;
       ele.innerHTML = this._len;
     },
     saveComment(sucess,fail){
       let av = AV.Object.extend(CONFIG.dataBase);
       let instance = new av();
       for (let i in cmtDataObj) {
         if (cmtDataObj.hasOwnProperty(i)) {
           let _v = cmtDataObj[i];
           instance.set(i, _v);
         }
       }
       instance.save().then((ret)=>{
         this.updateCache(ret);
         sucess && sucess(ret);
       }, function (error) {
         fail && fail(error);
       });
     },
     postData(configObj){
       let cmtEle = configObj.cmtEle,
         sucess = configObj.sucess,
         fail = configObj.fail;

       let len = this.checkInput(cmtEle)
       if (len==0) {
         alert('请输入评论');
         this.setFocus(cmtEle) //评论框
         return !1;
       }

       let html = this.getContent(cmtEle);

       cmtDataObj.comment = html; //挂载到数据包

       // 读取最后的用户数据
       for (let i = 0; i < CONFIG.lsArr.length; i++) {
        let v = localStorage[CONFIG.lsPrefix+CONFIG.lsArr[i]];
        if (!!v) {
           cmtDataObj[CONFIG.lsArr[i]] = v;
        }
       }
       cmtEle==JmainCmt && (cmtDataObj.targetFloor=''); // 主评论没有目标楼层

       this.saveComment((ret)=>{
         this.renderNewCmt(ret);
         this.clearCmt(cmtEle);
         this.setCmtNum();
         sucess && sucess()
       },(error)=>{
         console.log(error)
         fail && fail()
       });
     },
     insertReplyForm(wrap){
       this.lastId = wrap.id;
       wrap.appendChild(this.replyForm);
       this.setData(wrap,'status','1');
       this.setPlaceHolder(JreplyCmt);
       this.replyForm.style.display = 'block';
       this.setFocus(JreplyCmt);
       cmtDataObj.targetFloor = this.lastId;
     },
     removeReplyForm(cb){
       let lastTarget =  doc.getElementById(this.lastId)
       this.setData(lastTarget,'status','0')
       this.replyForm.style.display = 'none';
       doc.getElementById(this.lastId).removeChild(this.replyForm);
       cb && cb()
     },
     toggleReplyForm(wrap,isShowed){
       if (isShowed == '1') {
         this.setData(wrap,'status','0')
         this.replyForm.style.display = 'none';
       }else{
         this.setData(wrap,'status','1')
         this.setPlaceHolder(JreplyCmt)
         this.replyForm.style.display = 'block';
         this.setFocus(JreplyCmt);
       }
     },
     fetchUserInfo(){
      let lsArr = CONFIG.lsArr;
      for (let i = 0; i < lsArr.length; i++) {
        let ipt = doc.getElementById('J'+lsArr[i]);
        ipt.value = localStorage.getItem(CONFIG.lsPrefix+lsArr[i]);
      }
     },
     bindEvent(){
       let clickHandler = (e)=>{
         let target = e.target
         let eventType = this.getData(target,'event');
         switch(eventType){
           case 'postCmt' :
             this.postData({
               cmtEle: JmainCmt,
               sucess:()=>{},
               fail:()=>{}
             });
             break;
           case 'postReply' :
             this.postData({
               cmtEle:JreplyCmt,
               sucess:()=>{
                 this.toggleReplyForm(doc.getElementById(this.lastId),'1');
               },
               fail:()=>{}
             });
             break;
           case 'reply' :
             let targetId = this.getData(target,'id'); // 按钮存储objectId
             let wrap = doc.getElementById(targetId),
               isShowed = this.getData(wrap,'status');
             this.placeholder = this.getData(wrap,'placeholder');

             if (this.lastId==null) {
               this.generateReplyForm(()=>{
                 this.insertReplyForm(wrap);
               });
             }else{
               if (this.lastId==wrap.id) {
                 this.toggleReplyForm(wrap,isShowed)
               }else{
                 this.removeReplyForm(()=>{
                   this.insertReplyForm(wrap);
                   this.toggleReplyForm(wrap,isShowed)
                 });
               }
             }
             break;
           default:
         }
       }

      let keyUpHandler = (e)=>{
        e.preventDefault();
        let target = e.target;
        let itemName = this.getData(target,'name');
        let v =  target.value.trim();
        switch (itemName) {
          case 'nick':
            localStorage.setItem(CONFIG.lsPrefix+'nick', v);
            break;
          case 'email':
            localStorage.setItem(CONFIG.lsPrefix+'email', v);
            break;
          case 'link':
            localStorage.setItem(CONFIG.lsPrefix+'link', v);
            break;
          default:
            break;
        }
       }

       doc.body.addEventListener('click',clickHandler,false);
       Jnick.addEventListener('keyup',keyUpHandler,false);
       Jemail.addEventListener('keyup',keyUpHandler,false);
       Jlink.addEventListener('keyup',keyUpHandler,false);
     }
   }
   win.CMT = CMT;
})(window,document);
