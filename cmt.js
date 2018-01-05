;(function (cmtConfig,window) {
  /**
   * @k 评论原型
   *
   * 主要部分
   * - 富文本编辑器
   * - 评论框(富文本编辑器)复用
   * - 登录表单(单例模式)
   * - 表情处理(类似新浪微博处理方式比较合理)
   * - 对用户输入进行转义(非常重要)
   * - 对评论框,回复框动态插入ID
   * - ...
   *
   * 次要部分
   * - Ajax
   * - 异步加载样式表
   * - 验证码
   * - 接口处理
   * - 评论结构复用
   * - ...
   */

// 此处只是实现了大致原型, 回复框和楼层嵌套之类的原理类似, 不再实现.
  var TPL={
    loginForm: `
      <div class="cmtarea-account">
        <iframe name="loginIframe" id="loginIframe" width="0" height="0" scrolling="no" frameborder="0" style="visibility:hidden">
        </iframe>
        <form class="cmt-login-form" autocomplete="off" action="{{loginUrl}}" method="post" target="loginIframe" id="loginForm" accept-charset="UTF-8">

          <label for="usernameInput" class="grayInputLabel">
          </label>
          <input type="text" maxlength="32" class="input grayInput" name="username" id="usernameInput" placeholder="用户名/邮箱/手机号" title="用户名/邮箱/手机号">
          <label for="passwordInput" class="grayInputLabelPass">
          </label>
          <input type="password" maxlength="32" class="input grayInput" name="password" id="passwordInput" title="请输入密码" placeholder="密码">
          <input name="captcha" type="text" class=" grayInput grayInput-cap" id="grayInput-cap" placeholder="输入验证码">
          <img data-src="{{captchaUrl}}" id="grayInput-cap-img" class=" grayInput-cap-img" data-event="loginformChangeCaptcha">
          <input name="auto_login" type="hidden" value="3600">
          <input type="hidden" name="return" value="{{proxyUrl}}">
          <input type="submit" style="border: medium none;" value="登&nbsp;录" id="loginBtn" name="loginBtn" class="regbut">
          <b class="cmtarea-account-separator hide-for-cap">|</b>
          <a href="{{registerUrl}}" class="hide-for-cap" target="_blank">注册</a> <a href="{{forgetPwdUrl}}" class="getpass hide-for-cap" target="_blank">忘记密码？</a>
        </form>
      </div>
    `,
    dataTpl(){
      return `
        <div class="cmt-user-avatar">
          <a href="{{user-center}}" class="user-center-link" target="_blank">
            <img class="user-avatar-img">
          </a>
        </div>
        <div class="cmt-item-data-wrap">
          <!-- hd s-->
          <div class="cmt-item-data-hd">
            <!-- floor -->
            <span class="cmt-item-data-floor">{{floor}}楼</span>
            <!-- data-user -->
            <a class="cmt-item-data-user">{{userName}}</a>
            <!-- create-time -->
            <span class="cmt-item-data-time">{{createTime}}</span>
            <!-- vote (todo) -->
          </div>
          <!-- hd e -->

          <!-- bd s -->
          <p class="cmt-item-data">{{cmtItemData}}</p>
          <!-- bd e -->

          <!-- ft s -->
          <div class="cmt-item-data-hd-ft">
            <a class="cmt-item-reply-btn">回复</a>
          </div>
          <!-- ft e -->
        </div>

    `}

  }
  let common = {
    getEvent(el){
      return el.getAttribute('data-event')
    },
    getHtml(el){

    },
    checkInput(){
      // 这里用的是 div+contenteditable , 默认转义用户输入
      // 如果用的是textarea等,不会被转义,要过滤, textarea则是value
      let len = mainCmt.innerHTML.length
      return len;
    },
    setFocus(obj){
        obj.focus();
        var range = window.getSelection();
        range.selectAllChildren(obj);
        range.collapseToEnd();
    },
    getContent: function() {
      // contenteditable 默认转义<>
      // textarea,iframe 不转义<>
      return this.getCleanText()
        .replace(/&nbsp;/ig, ' ')
        .replace(/&lt;/ig, '<')
        .replace(/&gt;/ig, '>');
    },
    randomID(prefix) {  // 随机ID
      return prefix + Math.random().toString(32).slice(2);
    },
    stripTags: function(el, tagName) {
      var els = el.getElementsByTagName(tagName.toUpperCase());
      for (var i = 0; i < els.length; i++) {
        while (els[i].firstChild)
          els[i].parentNode.insertBefore(els[i].removeChild(els[i].firstChild), els[i]);
        els[i].parentNode.removeChild(els[i--]);
      }
    },
    getCleanText: function() {
      var ele = mainCmt;
      var clone = ele.cloneNode(true);
      clone.innerHTML = this.html2txt(clone.innerHTML);
      this.stripTags(clone, '*'); //处理所有用户拖拽进入的标签
      return clone.innerHTML.replace(/(?:\s|&nbsp;)*$/g, '');
    },
    html2txt: function(html) {
      var res = html.replace(/&nbsp;/igm, ' ')
        .replace(/(?:<br\s*\\?>)+/igm, '\n') // <br /> -> \n
        .replace(/<div>(.*?)<\/div>/igm, "\n$1") // <div>text</div> -> \ntext
        .replace(/<p>(.*?)<\/p>/igm, "\n$1"); // <p>text</p> -> \ntext

      return res;
      // return html;
    },
    postComment(){
      let len = this.checkInput()
      // let len =10;
      if (len==0) {
        alert('请输入评论');
        this.setFocus(mainCmt)
        return !1;
      }
      if (len<5) {
        alert('评论不能少于五个字');
        this.setFocus(mainCmt)
        return !1;
      }
      let html = this.getContent();
      let _html = encodeURI(html)
      let ele = document.createElement('li');
      ele.classList ='cmt-item';
      let tpl = TPL.dataTpl().replace(/{{cmtItemData}}/g,decodeURIComponent(_html));
      ele.innerHTML = tpl;
      cmtList.appendChild(ele)
      this.cleanTxt()
    },
    cleanTxt(){
      mainCmt.innerHTML = ''
    },
  }

  let mainCmt = document.getElementsByClassName('cmt-main-txtarea')[0];
  mainCmt.id = 'JmainCmt';

  let cmtList = document.getElementsByClassName('cmt-list')[0];
  cmtList.id = 'JcmtList';

  let clickHandler = (e)=>{
    let target = e.target
    let eventType = common.getEvent(target);
    switch(eventType){
      case 'postcmt' :
        common.postComment();
      break;
    }
  }
  document.body.addEventListener('click',clickHandler,false);
})(window.cmtConfig||{}, window);
