/**
 * docusky.ui.getDbCorpusDocumentsSimpleUI.js
 * (URL)
 *
 * (Description)
 * 這是利用 docusky web api 所包裝起來的一份 JavaScript
 * Note: - this component is developed and tested under Firefox
 *       - requires jquery
 *
 * @version
 * 0.01 (April 30 2016)
 * 0.02 (August 30 2016)
 * 0.03 (December 20 2016) adds PostClassification and TagAnalysis functions
 * 0.04 (January 18 2017) adds channelBuffer support
 * 0.05 (January 24 2017) fix css class name (adds prefix 'dsw-' to better avoid naming conflicts) 
 *                        also fix channelBuffer problems in async mode
 * 0.06 (June 19 2017) modify the position of dynamic icons (change "none" to "fix")
 * 0.07 (July 17 2017) add hideLoadingIcon(), hideWidget()
 * 0.08 (July 29 2017) set "private" methods, add myVer to widget title
 * 0.09 (Sept 15 2018) adds "fieldsOnly" to urlGetQueryResultDocumentsJson parameter
 * 0.10 (Oct 06 2018)  adds a showPublicDbLink to login container for accessing open databases
 * 0.11 (Oct 15 2018)  adds some functions to support future providers API
 * 
 * @copyright
 * Copyright (C) 2016-2018 Hsieh-Chang Tu
 *
 * @license
 *
 */
 
if (window.navigator.userAgent.indexOf("MSIE ") > 0) {
   alert("抱歉，DocuSky 工具目前只支援 Firefox 與 Chrome");
}

var ClsDocuskyGetDbCorpusDocumentsSimpleUI = function(param) {     // class (constructor)
   var me = this;

   this.package = 'docusky.ui.getDbCorpusDocumentsSimpleUI.js';    // 主要目的：取得給定 db, corpus 的文件
   this.version = 0.11;                             // 2018-10-15
   this.idPrefix = 'CorpusDoc_';                    // 2016-08-13

   this.showPublicDbLink = true;                    // 2018-09-30, 2018-10-16
   this.enableGetProviderList = false;              // 設定是否嘗試從 api 取得 providers（需 DocuSky 支援 provider api）
   
   this.utility = null;
   this.protocol = null;                            // 'http',
   this.urlScriptPath = null;
   this.urlWebApiPath = null;
   this.urlLogin = null;
   this.urlGetDbCorpusListJson = null;
   this.urlGetQueryResultDocumentsJson = null;
   this.urlGetQueryPostClassificationJson = null;   // 2016-12-18
   this.urlGetQueryTagAnalysisJson = null;          // 2016-12-19
   this.urlUpdateCorpusDocumentJson = null;
   this.urlGetProviderListJson = null;              // 2018-10-12
   
   this.callerEvent = null;
   this.callerCallback = null;                      // 儲存成功執行後所需呼叫的函式
   this.callerCallbackParameters = null;            // 儲存回呼函式的傳入參數
   this.initialized = false;
   this.target = 'USER';                            // 'target', 'db', 'corpus' are input parameters of urlGetQueryResultDocumentsJson
   this.db = '';
   this.corpus = '';
   this.query = '';                                 // 儲存最後一個 query
   this.fieldsOnly = undefined;                     // 2018-09-14
   
   this.loadingIconWidth = 140;                     // 2017-06-19: size of the loading image
   this.displayLoadingIcon = true;                  // 2017-07-13
   this.displayWidget = true;                       // 2017-07-24
   
   // login action
   this.loginInvokeFun = null;
   this.loginInvokeFunParameters = null;
   
   // returns
   this.totalFound = 0;
   this.page = 1;
   this.pageSize = 200;                        // default page size
   this.docList = [];                          // 儲存 DocuSky 的文件列表 (if fieldsOnly ==> the content will be doc metadata only)
   this.spotlights = '';
   this.postClassification = {};
   this.features = '';
   this.tagAnalysis = {};
   this.channelBuffer = {};                    // store query results in "channels" (access by channelKey)
   
   // extra data
   this.providerList = [];                     // 2018-10-12
   
   if (typeof(param)=='object' && 'target' in param) {
      me.target = (param.target.toUpperCase() == 'OPEN') ? 'OPEN' : 'USER';
   }
   
   // =================================
   //       main functions
   // =================================

   var init = function() {
      //var scriptPath = me.utility.getScriptPath();
      //me.urlScriptPath = scriptPath.protocol + '://' + scriptPath.host + '/' + me.utility.dirname(scriptPath.path) + '/webApi';
      // 注意： 由於利用 jQuery 動態載入 utility functions，call stack 最後會是在 jQuery 函式，因此不能從 me.utility.getScriptPath() 取得 script URL
      me.urlScriptPath = me.utility.dirname(me.utility.dirname(me.scriptPath + 'dummy'));
      me.urlWebApiPath = me.urlScriptPath + '/WebApi';
      
      let scheme = location.protocol.substr(0, location.protocol.length-1);
      let pos = me.urlWebApiPath.split('/', 3).join('/').length;    // find the 3rd occurrence of '/'
      let urlPath = me.urlWebApiPath.substr(pos);
      let curProvider = { title: 'Current',
                          type: 'api',
                          // DH project
                          // urlScheme: scheme,
                          urlScheme: 'http',
                          // DH project
                          // urlHost: location.hostname,
                          urlHost: 'docusky.digital.ntu.edu.tw',
                          urlPort: location.port,
                          // DH project
                          // urlPath: urlPath,
                          urlPath: '/docusky/WebApi',
                          description: 'Current'};
      me.providerList.push(curProvider);
      setUrlApiPath(me, curProvider);
      
      me.uniqueId = me.utility.uniqueId();
      //alert(me.uniqueId);
      

      // login container
      var loginContainerId = me.idPrefix + "loginContainer" + me.uniqueId;
      var loginContainerOverlayId = me.idPrefix + "loginContainerOverlay" + me.uniqueId;
      var closeLoginContainerId = me.idPrefix + "closeLoginContainer" + me.uniqueId;
      var dsUsernameId = me.idPrefix + "dsUsername" + me.uniqueId;
      var dsPasswordId = me.idPrefix + "dsPassword" + me.uniqueId;
      var loginSubmitId = me.idPrefix + "loginSubmit" + me.uniqueId;
      var closeLoginButtonId = me.idPrefix + "closeLoginButton" + me.uniqueId;
      var loginMessageId = me.idPrefix + "loginMessage" + me.uniqueId;
      var showProviderListId = me.idPrefix + "showProviderList" + me.uniqueId;
      
      var myVer = me.package + " - Ver " + me.version;
      var myProvider = (me.enableGetProviderList) ? "&nbsp;P&nbsp;" : "";
      var s = "<div id='" + loginContainerId + "' class='dsw-container'>"
			   + "<div id='" + loginContainerOverlayId + "' class='dsw-overlay'></div>"
            + "<div id='" + loginContainerId + "_TitleBar' class='dsw-titleBar'>"
            + "<table><tr>"
            + "<td class='dsw-titleContainer' title='Select DocuSky Provider'><nobr><span id='" + showProviderListId + "' class='dsw-span-listOption'>" + myProvider + "</span><span class='dsw-span-provider'></span><span class='dsw-titlename'>Login</span></nobr></td>"
            + "<td class='dsw-closeContainer' id='" + closeLoginContainerId + "'><span class='dsw-btn-close' id='" + closeLoginButtonId + "'>&#x2716;</span></td>"   // 2018-10-06: adds id for draggable with TitleBar
            + "</tr></table></div>"
            + "<div class='dsw-containerContent'>"
            + "<table>"
            + "<tr><td class='dsw-td-dslogin dsw-logintitle'>Username:</td><td class='dsw-td-dslogin'><input type='text' class='dsw-userinput' id='" + dsUsernameId + "'/></td></tr>"
            + "<tr><td class='dsw-td-dslogin dsw-logintitle'>Password:</td><td class='dsw-td-dslogin'><input type='password' class='dsw-userinput' id='" + dsPasswordId + "'/></td></tr>"
            + "<tr><td class='dsw-td-dslogin dsw-loginsubmit' colspan='2'><input id='" + loginSubmitId + "' type='submit' value='登入'/></td></tr>"
            + "<tr><td colspan='2' class='dsw-loginmsg' id='" + loginMessageId + "'></td></tr>"
            + ((me.showPublicDbLink) ? ("<tr><td colspan='2'><span class='dsw-listOpenCorpuses'>Public Databases</span></td></tr>") : "")
            + "</table>"
            + "</div>"
            + "</div>";
      $("html").append(s);
      $("#" + loginContainerId).hide();
      
      $("#" + loginSubmitId).click(function(e) {
         login($("#" + dsUsernameId).val(), $("#" + dsPasswordId).val());
      });
      $("#" + closeLoginButtonId).click(function(e) {
         $("#" + closeProviderListButtonId).click();           // close provider window
         $("#" + loginContainerId).fadeOut();
      });
      $("#" + showProviderListId).click(function(e) {
         displayProviderList(curProvider, e);
         $("#" + providerListContainerId).fadeIn();
      });
      
      $("span.dsw-listOpenCorpuses").click(function(e) {       // 2018-09-30
         //alert($(this).attr('id'));
         $("#" + loginContainerId).hide();
         var param = { target: 'OPEN',
                       invokeFunName: 'getDbCorpusDocumentsGivenPageAndSize'}; 
         displayDbCorpusList(param, e);
      });

      // 2018-10-13: providerList container
      var providerListContainerId = me.idPrefix + "providerListContainer" + me.uniqueId;
      var providerListContainerOverlayId = me.idPrefix + "providerListContainerOverlay" + me.uniqueId;
      var providerListContentId = me.idPrefix + "providerListContent" + me.uniqueId;
      var closeProviderListContainerId = me.idPrefix + "closeProviderListContainer" + me.uniqueId;
      var closeProviderListButtonId = me.idPrefix + "closeProviderListButton" + me.uniqueId;
      
      var s = "<div id='" + providerListContainerId + "' class='dsw-container' style='border-color:#3F3F3F; z-index:1002'>"
			   + "<div id='" + providerListContainerOverlayId + "' class='dsw-overlay'></div>"
            + "<div id='" + providerListContainerId + "_TitleBar' class='dsw-titleBar'>"
            + "<table><tr>"
            + "<td class='dsw-titleContainer' title='ProviderList'><nobr><span class='dsw-span-provider'></span><span class='dsw-titlename'>Providers</span></nobr></td>"
            + "<td class='dsw-closeContainer' id='" + closeProviderListContainerId + "'><span class='dsw-btn-close' id='" + closeProviderListButtonId + "'>&#x2716;</span></td>"
            + "</tr></table>"
            + "</div>"
            + "<div class='dsw-containerContent'>"
            + "<table>"
            + "</table>"
            + "<div id='" + providerListContentId + "' class='dsw-containerContent'>"
            + "</div>";
      $("html").append(s);
      $("#" + providerListContainerId).hide();
      
      $("#" + closeProviderListButtonId).click(function(e) {
         $("#" + providerListContainerId).fadeOut();
      });

      $("#" + providerListContainerId).draggable({
         containment: 'window',           // 2018-10-13: move within the 'window' box
         handle: '#' + providerListContainerId + '_TitleBar'
      });
      
      // dbCorpusListContainer container
      var dbCorpusListContainerId = me.idPrefix + "dbCorpusListContainer" + me.uniqueId;  
      var dbCorpusListContainerOverlayId = me.idPrefix + "dbCorpusListContainerOverlay" + me.uniqueId;
      var closeDbCorpusListButtonId = me.idPrefix + "closeDbCorpusListButton" + me.uniqueId;
      var closeDbCorpusListContainerId = me.idPrefix + "closeDbCorpusListContainer" + me.uniqueId;
      var dbCorpusListContentId = me.idPrefix + "dbCorpusListContent" + me.uniqueId;
      var logoutDBId = me.idPrefix + "logoutDB" + me.uniqueId;

      var s = "<div id='" + dbCorpusListContainerId + "' class='dsw-container'>"
			   + "<div id='" + dbCorpusListContainerOverlayId + "' class='overlay'></div>"
            + "<div id='" + dbCorpusListContainerId + "_TitleBar' class='dsw-titleBar'>"
            + "<table><tr><td class='dsw-titleContainer'>"     // 2018-10-06: adds id to title bar for draggable event
            + "<nobr><span class='dsw-span-provider'></span><span id='" + dbCorpusListContainerId + "_Title' class='dsw-titlename' title='DbCorpusList'>DbCorpus List</span></nobr></td>"
            + "<td class='dsw-closeContainer' id='" + closeDbCorpusListContainerId + "'>"
            + "<span class='dsw-btn-close' id='" + closeDbCorpusListButtonId + "'>&#x2716;</span>"
            + "<span class='dsw-btn-logout' id='" + logoutDBId + "' title='登出'>Logout</span></td></tr>"
            + "</table></div>"
            + "<div id='" + dbCorpusListContentId + "' class='dsw-containerContent'>"
            + "</div>"
            + "</div>";
      $("html").append(s);
      $("#" + dbCorpusListContainerId).hide();
		
	   $("#" + logoutDBId).click(function(e) {
         e.preventDefault();
         $.ajaxSetup({xhrFields: {withCredentials: true}});
         $.get(me.urlLogout, function(jsonObj) {
            //me.utility.displayJson(jsonObj);
            if (jsonObj.code == 0) {         // successfully logged out
               alert("Successfully logged out");
            }
            else {
               alert(jsonObj.code + ': ' + jsonObj.message);
            }
			$("#" + dbCorpusListContainerOverlayId).show();
			$("#" + dbCorpusListContainerId).fadeOut();
         }, 'json');
		   // Clear out obtained document list
		   me.docList = [];
      });
		
      $("#" + closeDbCorpusListButtonId).click(function(e) {
         $("#" + dbCorpusListContainerOverlayId).show();
         $("#" + dbCorpusListContainerId).fadeOut();
      });
      
      // loadingContainer
      var loadingContainerId = me.idPrefix + "loadingContainer" + me.uniqueId;
      var loadingSignId = me.idPrefix + "loadingSign" + me.uniqueId;
      var workingProgressId = me.idPrefix + "workingProgressId" + me.uniqueId;
      var s = "<div id='" + loadingContainerId + "' style='position:absolute; border:3px grey solid; border-radius:6px; background-color:white; font-size:medium; z-index:1003;'>" +
              "<div id='" + loadingSignId + "'>" +
              "<img src='" + me.urlWebApiPath + "/images/loading-circle.gif' width='" + me.loadingIconWidth + "' border='0'/>" +
              "</div>" +
              "<div id='" + workingProgressId + "' style='position:absolute; top:60px; width:100%; text-align:center;'></div>" +
              "</div>";
      $("html").append(s);
      $("#" + loadingContainerId).hide();
      
      // 2018-10-12: set provider list
      if (me.enableGetProviderList) {
         // location.procotol contains ':'
         let url = me.urlGetProviderListJson + "?scheme=" + ((scheme == 'http') ? "http,https" : scheme);
         $.ajax({ url: url, method: "GET"})
            .done(function(retObj) {
               if (retObj.code == 0) {
                  var curProvider = me.providerList[0];
                  retObj.message.forEach(function(item, idx) {
                     if (item.urlScheme.toLowerCase() != curProvider.urlScheme.toLowerCase() 
                         || item.urlHost.toLowerCase() != curProvider.urlHost.toLowerCase()
                         || item.urlPort.toLowerCase() != curProvider.urlPort.toLowerCase()
                         || item.urlPath.toLowerCase() != curProvider.urlPath.toLowerCase()) {
                        me.providerList.push(item);
                     }
                  });
               }
               else alert("Error: " + retObj.message);
               //setUrlApiPath(me, me.providerList[1]);     // test
            })
            .fail(function(jqXHR, textStatus) {
               // bypass this silently...
               //alert(me.urlGetProviderListJson + " request failed: " + textStatus);
            })
            .always(function() {
               // 2018-10-14
               var showProviderListId = me.idPrefix + "showProviderList" + me.uniqueId;
               if (me.providerList.length <= 1) $("#" + showProviderListId).hide("");
            });
      };
      
      // 2017-01-17: clear variables
      me.channelBuffer = {};
      me.initialized = true;
   };
   
   var setUrlApiPath = function(obj, provider) {                // 2018-10-12
      if (provider.urlScheme == 'https') {
         var port = (provider.urlPort != "443") ? (":" + provider.urlPort) : "";
      }
      else {
         port = (provider.urlPort != "80") ? (":" + provider.urlPort) : "";
      }
      var urlApiPath = provider.urlScheme + "://" + provider.urlHost + port + provider.urlPath;
      //alert("SET API PATH: " + urlApiPath);

      obj.urlLogin = urlApiPath + '/userLoginJson.php';
	   obj.urlLogout = urlApiPath + '/userLogoutJson.php';
      obj.urlGetDbCorpusListJson =  urlApiPath + '/getDbCorpusListJson.php';
      obj.urlGetQueryResultDocumentsJson =  urlApiPath + '/getQueryResultDocumentsJson.php';
      obj.urlGetQueryPostClassificationJson = urlApiPath + '/getQueryPostClassificationJson.php';
      obj.urlGetQueryTagAnalysisJson = urlApiPath + '/getQueryTagAnalysisJson.php';
      obj.urlUpdateCorpusDocumentJson = urlApiPath + '/updateCorpusDocumentJson.php';
      obj.urlGetProviderListJson = urlApiPath + '/getProviderListJson.php';
      
      obj.curProvider = JSON.parse(JSON.stringify(provider));    // copy content
      $(".dsw-span-provider").html(provider.title);
   };
   
   var login = function(username, password) {
      //$.ajaxSetup({async:false});
      //var postdata = { dsgUname: username, dsgPword: password };     // camel style: to get dbCorpusDocuments
      //$.post("../DocuGate/webApi/userDispatcherLoginJson.php", postdata, function(jsonObj) {
      var postdata = { dsUname: username, dsPword: password };     // camel style: to get dbCorpusDocuments
      $.post(me.urlLogin, postdata, function(jsonObj) {
         //me.utility.displayJson(jsonObj);
         var loginMessageId = me.idPrefix + "loginMessage" + me.uniqueId;
         var loginContainerOverlayId = me.idPrefix + "loginContainerOverlay" + me.uniqueId;
         var loginContainerId = me.idPrefix + "loginContainer" + me.uniqueId;
         if (jsonObj.code == 0) {               // successfully login
            $("#" + loginMessageId).empty();    // 成功登入，清除（先前可能有的）訊息
            $("#" + loginContainerOverlayId).show();
            $("#" + loginContainerId).fadeOut();
            // 登入後，就自動載入第一頁的內容... 日後該改為可由工具自行設定
            if (typeof me.callerCallback === "function" && typeof me.loginInvokeFun === "function") {
               me.loginInvokeFun.apply(me, me.loginInvokeFunParameters);
            }
            else {
               me.target = 'USER';              // 2018-10-02
               //me.getDbCorpusDocuments(me.target, me.db, me.corpus, me.callerEvent, me.callerCallback, me.callerCallbackParameters);
               // 2018-09-15
               var param = { target: me.target,
                             db: me.db,
                             corpus: me.corpus,
                             page: me.page,
                             pageSize: me.pageSize,           // 2018-09-18: fix bug (misspelled "pageSizde")
                             fieldsOnly: me.fieldsOnly,
                             };
               //alert(JSON.stringify(param));
               me.getQueryResultDocuments(param, null, me.callerCallback);

            }
         }
         else if (jsonObj.code == 101) ;   // alert("Login fails: requires login");       // Requires login
         else {
            $("#" + loginMessageId).html(jsonObj.code + ': ' + jsonObj.message);
         }
      }, 'json');
      //$.ajaxSetup({async:true});
   };
   
   // -------------- object "public" functions ---------
   me.addExtraApiFunctions = function(func) {        // e.g., add extra/docusky.dbRefdataAPI.js
      if (typeof func === 'function') func(me);
      else alert("Argument of addExtraFunctions() must be a function");
   };
   
   me.setLoginAction = function(loginInvokeFun, loginInvokeFunParameters) {
      me.loginInvokeFun = loginInvokeFun;
      me.loginInvokeFunParameters = loginInvokeFunParameters;
   }
   
   var displayDbCorpusList = function(param, evt) {          // list all db/corpus pairs (not the corpuses under a given db)
      var loginContainerId = me.idPrefix + "loginContainer" + me.uniqueId;
      $("#" + loginContainerId).hide();
      
      // show loading icon
      var loadingContainerId = me.idPrefix + "loadingContainer" + me.uniqueId;
      var workingProgressId = me.idPrefix + "workingProgressId" + me.uniqueId;
      $("#" + loadingContainerId).show().position({my: "left+25 top+25", at: "center bottom", of: evt, collision: "fit"});
      $("#" + workingProgressId).html("connecting");
      
      var dbCorpusListContentId = me.idPrefix + "dbCorpusListContent" + me.uniqueId;
      var dbCorpusListContainerOverlayId = me.idPrefix + "dbCorpusListContainerOverlay" + me.uniqueId;
      var dbCorpusListContainerId = me.idPrefix + "dbCorpusListContainer" + me.uniqueId;

      var target = param.target;
      var titleId = dbCorpusListContainerId + "_Title";
      $("#" + titleId).html(target + " corpus list");     // 2018-10-02, 2018-10-13
      
      var invokeFunName = param.invokeFunName;
      
      //$.ajaxSetup({async:false});
      $.ajaxSetup({xhrFields: {withCredentials: true}});
      $.get(me.urlGetDbCorpusListJson + '?target=' + target, function(data) {
         $("#" + loadingContainerId).hide();
         if (data.code == 0) {          // success
            //me.utility.displayJson(data);
            var dbCorpusList = data.message;
            //me.utility.displayJson(dbCorpusList);
            var contentTableId = me.idPrefix + "dbCorpusContentTable" + me.uniqueId;
            var s = "<table id='" + contentTableId + "' class='dsw-tableContentList'>";
            for (var i=0; i<dbCorpusList.length; i++) {
               var target = dbCorpusList[i]['target'];
               var db = dbCorpusList[i]['db'];
               var corpus = dbCorpusList[i]['corpus'];
               var page = me.page; // 2018-07-03 wayne
               var pageSize = me.pageSize;
               var channelKey = me.channelKey;         // 2018-09-14
               var fieldsOnly = me.fieldsOnly;         // 2018-09-14
               var num = i + 1;
               var urlParam = "target=" + target + "&db=" + db + "&corpus=" + corpus + "&query=.all&page=" + page + "&pageSize=" + pageSize
                            + (fieldsOnly ? "&fieldsOnly=" + fieldsOnly : '');
               s += "<tr class='dsw-tr-contentlist'><td class='dsw-td-contentlist dsw-td-contentlist-num'>" + num + ".</td><td class='dsw-td-contentlist dsw-td-contentlist-dbname'>" + db + "</td><td class='dsw-td-contentlist dsw-td-contentlist-corpusname'>" + corpus + "</td><td class='dsw-td-contentlist dsw-td-contentlist-load'>"
                  + "<nobr><a class='loadDbCorpusDocument' href='dummy?" + urlParam + "'>載入</a></nobr>"       // 2018-09-04: add <nobr>
                  + "</td></tr>";
            }
            if (me.showPublicDbLink) {               // 2018-09-30
               s += (target == 'OPEN') 
                  ? "<tr><td colspan='3' align='center'><span class='dsw-listPersonalCorpuses'>Show Personal Databases</span></td></tr>"
                  : "<tr><td colspan='3' align='center'><span class='dsw-listOpenCorpuses'>Show Public Databases</span></td></tr>";
            }
            s += "</table>";
            me.target = target;                        // set target to object scope

            //var w = $("#" + contentTableId).width();
            $("#" + dbCorpusListContentId).width(600);         // 設定寬度
            $("#" + dbCorpusListContentId).html(s);

            // 2018-09-30: needs to place event hander for switching open/personal corpuses
            $("span.dsw-listOpenCorpuses").unbind("click").click(function(e) {
               var param = { target: 'OPEN',
                             invokeFunName: 'getDbCorpusDocumentsGivenPageAndSize'}; 
               displayDbCorpusList(param, e);
            });

            $("span.dsw-listPersonalCorpuses").unbind("click").click(function(e) {
               var param = { target: 'USER',
                             invokeFunName: 'getDbCorpusDocumentsGivenPageAndSize'}; 
               displayDbCorpusList(param, e);
            });

            $(".loadDbCorpusDocument").click(function(e) {
               e.preventDefault();
               var url = this.href;
               var target = me.utility.getUrlParameterVarValue(url, 'target');
               var db = me.utility.getUrlParameterVarValue(url, 'db');
               var corpus = me.utility.getUrlParameterVarValue(url, 'corpus');
               var page = me.utility.getUrlParameterVarValue(url, 'page');
               var pageSize = me.utility.getUrlParameterVarValue(url, 'pageSize');
               var fieldsOnly = me.utility.getUrlParameterVarValue(url, 'fieldsOnly');    // 2018-09-15
			      // 2016-08-30(pykenny) remove argument "message"
               //me.getDbCorpusDocumentsGivenPageAndSize(target, db, corpus, page, pageSize, me.callerEvent, me.callerCallback);    // me.callerCallback 負責將載入的內容顯示出來
               
               // 2017-01-17: 先前沒規劃好，讓函式具有相同的參數結構，現在只好用 switch 個別檢查...
               //             否則，若能用 callback.apply()，程式就會漂亮許多..
               //             例如：callback.apply(me, [target, db, corpus, page, pageSize, me.callerEvent, me.callerCallback]);    // me.callerCallback 負責將載入的內容顯示出來
               var param = { target: target,
                             db: db,
                             corpus: corpus,
                             page: page,
                             pageSize: pageSize,                  // 2018-09-18: fix bug (misspelled "pageSizde")
                             fieldsOnly: fieldsOnly,              // 2018-09-15
                             };
               switch (invokeFunName) {
               case 'getDbCorpusDocumentsGivenPageAndSize':
                  // me.callerCallback 負責將載入的內容顯示出來
                  // 2017-07-22: 注意，傳入當前的 event e，而非 me.callerEvent
                  //me.getDbCorpusDocumentsGivenPageAndSize(target, db, corpus, page, pageSize, e, me.callerCallback, null);    
                  me.getQueryResultDocuments(param, e, me.callerCallback);     // 2018-09-15
                  break;
               case 'getQueryPostClassification':
                  me.getQueryPostClassification(param, me.callerEvent, me.callerCallback, me.callerCallbackParameters);
                  break;
               case 'getQueryTagAnalysis':
                  me.getQueryTagAnalysis(param, me.callerEvent, me.callerCallback, me.callerCallbackParameters);
                  break;
               default:
                  // unsupported function
                  console.log("Unsupported function: " + invokeFunName);
               }
            });
			
            $("#" + dbCorpusListContainerOverlayId).show();
            // 2016-05-24: 必須在顯示之後，才能取得 render 之後的 height...
            //             To get an accurate value, ensure the element is visible before using .height()
            let jelement = $("#" + dbCorpusListContainerId);
            let duration = 200;
            let opacity = 1;
            jelement.fadeTo(duration, opacity, function() {
               // 2018-10-02
               //let h = $(this).height();
               let h = $("#" + dbCorpusListContentId).height();    // 2018-10-08
               h = Math.min(360, Math.max(h,50));
               $("#" + dbCorpusListContentId).height(h);
               $(this).position({my: "left top", at: "center bottom", of: evt, collision: "fit"});    // 20170619: change "none" to "fit"
            });
			   $("#" + dbCorpusListContainerOverlayId).hide();
            //jelement.position({my: "left top", at: "center bottom", of: evt, collision: "fit"});    // 20170619: change "none" to "fit"

            //alert(h);
            //$("#" + dbCorpusListContentId).height(h);
         }
         else {
            if (data.code == '101') {            // 2018-09-30: requires login
               $("#" + dbCorpusListContainerId).hide();
               let loginContainerId = me.idPrefix + "loginContainer" + me.uniqueId;
               $("#" + loginContainerId).show();
            }
            else {
               alert("Error: " + data.code + "\n" + data.message);
            }
         }
      }, 'json');
      //$.ajaxSetup({async:true});
   };

   var displayProviderList = function(curProvider, evt) {
      var providerListContainerId = me.idPrefix + "providerListContainer" + me.uniqueId;
      var providerListContainerOverlayId = me.idPrefix + "providerListContainerOverlay" + me.uniqueId;
      var providerListContentId = me.idPrefix + "providerListContent" + me.uniqueId;
      
      var providers = me.providerList;
      // TODO: show content...
      var contentTableId = me.idPrefix + "providerContentTable" + me.uniqueId;
      var s = "<table id='" + contentTableId + "' class='dsw-tableContentList'>";
      for (var i=0; i<providers.length; i++) {
         let title = providers[i].title;
         let host = providers[i].urlScheme + "://" + providers[i].urlHost;
         let description = providers[i].description;
         s += "<tr class='dsw-tr-contentlist'>"
            + "<td class='dsw-td-contentlist dsw-td-contentlist-num'>" + (i+1) + ".</td>"
            + "<td class='dsw-td-contentlist'>" + title + "</td>"
            + "<td class='dsw-td-contentlist'>" + host + "</td>"
            + "<td class='dsw-td-contentlist'>" + description + "</td>"
            + "<td class='dsw-td-contentlist'><nobr><a class='dsw-a-switchProvider' x-title='" + title + "'>選擇</a></nobr></td>"
            + "</tr>";
      }
      s += "</table>";
      $("#" + providerListContentId).html(s);
      
      $(".dsw-a-switchProvider").click(function() {
         var title = $(this).attr("x-title");
         me.providerList.forEach(function(provider, idx) {
            if (provider.title == title) {
               setUrlApiPath(me, provider);
               return;
            }
         });
         $("#" + providerListContainerId).hide();
      });
      
      $("#" + providerListContainerId).css({top:0, left:0, position:'absolute'});    // needs to reset position first? (or, the position will move if clicking several times?)
      $("#" + providerListContainerOverlayId).show();
      let jelement = $("#" + providerListContainerId);
      let duration = 200;
      let opacity = 1;
      let h = $("#" + providerListContentId).height
      h = Math.min(300, Math.max(h,50));
      $("#" + providerListContentId).height(h);
      //alert(evt.pageX + ':' + evt.pageY);
      jelement.position({my:"left+20 top", at:"center bottom", of:evt, collision:"none"});
      //jelement.css({top: evt.pageX, left: evt.pageY, position:'absolute'});
		$("#" + providerListContainerOverlayId).hide();
   };
   
   me.getDbCorpusDocuments = function(target, db, corpus, evt, successFunc) {
      var param = { 'target': target,
                    'db': db,
                    'corpus': corpus,
                    'query': '.all',
                    'page': 1,
                    'pageSize': me.pageSize };
      me.getQueryResultDocuments(param, evt, successFunc);
   };
   
   // 2016-08-19: pykenny adds "message" to the parameter list
   // 2016-08-30(pykenny): fix problem when argument 'message' is not given
   // note: me function does not support "callback parameters" (for backward compatibility)
   me.getDbCorpusDocumentsGivenPageAndSize = function(target, db, corpus, page, pageSize, evt, successFunc, message) {
      me.pageSize = pageSize;
	  
	   var msg = "";
	   // reset links got by init(): urlGetDbCorpusListJson.php
      $(".loadDbCorpusDocument").each(function(idx){
         var href = $(this).attr('href');
         href = href.replace(/page=\d+/,'page='+pageSize);
         $(this).attr('href', href);
      });
	  
	   if (typeof message === "undefined" || !message){
		   msg = "page: " + page;
	   } else {
		   msg = message.toString();
	   }
	  
      var param = { 'target': target,
                    'db': db,
                    'corpus': corpus,
                    'query': '.all',
                    'page': page,
                    'pageSize': pageSize,
                    'message': msg};
					
      me.getQueryResultDocuments(param, evt, successFunc);
   };
   
   me.hideLoadingIcon = function(bool) {
      me.displayLoadingIcon = (bool === false);
   };

   me.hideWidget = function(bool) {
      me.displayWidget = (bool === false);
      if (!me.displayWidget) {
         //var dbCorpusListContainerId = me.idPrefix + "dbCorpusListContainer" + me.uniqueId;
         //$("#" + dbCorpusListContainerId).hide();
         //var loginContainerId = me.idPrefix + "loginContainer" + me.uniqueId;
         //$("#" + loginContainerId).hide();
         $(".dsw-container").find(".dsw-btn-close").click();	  // 2018-10-13: from TagTerm Stats Tool
      }
   };
  
   me.getQueryResultDocuments = function(param, evt, successFunc, successFuncParameters) {
      var my = null;
      
      if (typeof(param) !== 'object') param = {};
      var target = ('target' in param) ? param.target : 'USER';
      var db = ('db' in param) ? param.db : '';
      var corpus = ('corpus' in param) ? param.corpus : '';
      var query = ('query' in param) ? param.query : '.all';
      var page = ('page' in param) ? param.page : 1;
      var pageSize = ('pageSize' in param) ? param.pageSize : 200;
      var message = ('message' in param) ? param.message : ('page: ' + page); 
      var channelKey = ('channelKey' in param) ? param.channelKey: '';       // 2017-01-17
      var fieldsOnly = ('fieldsOnly' in param) ? param.fieldsOnly: '';       // 2018-09-15
      //alert(JSON.stringify(param));
      
      if (channelKey) {
         me.channelBuffer[channelKey] = {};
         my = me.channelBuffer[channelKey];
      }
      else my = me;
      my.callerEvent = evt;
      my.callerCallback = successFunc;
      my.callerCallbackParameters = successFuncParameters;
      my.target = target.toUpperCase();
      if (my.target != 'OPEN') my.target = 'USER';
      my.db = db;
      my.corpus = corpus;
      my.query = query;
      my.page = page;                // 2018-07-03 wayne
      my.pageSize = pageSize;        // 2018-07-03 wayne
      my.channelKey = channelKey;    // 2018-09-14
      my.fieldsOnly = fieldsOnly;    // 2018-09-14

      // many variables (e.g., dbCorpusListContainerId) are defined outside me function... cannot access directly?
      var dbCorpusListContainerId = me.idPrefix + "dbCorpusListContainer" + me.uniqueId;
      var dbCorpusListContainerOverlayId = me.idPrefix + "dbCorpusListContainerOverlay" + me.uniqueId;
      var loginContainerId = me.idPrefix + "loginContainer" + me.uniqueId;
      var loginContainerOverlayId = me.idPrefix + "loginContainerOverlay" + me.uniqueId;
      var loadingContainerId = me.idPrefix + "loadingContainer" + me.uniqueId;
      var workingProgressId = me.idPrefix + "workingProgressId" + me.uniqueId;
      
      // If Container is visible, adjust the opacity and block click events (by overlay layer)
	   if ($("#" + dbCorpusListContainerId).is(":visible")) {
		   $("#" + dbCorpusListContainerOverlayId).show();
		   $("#" + dbCorpusListContainerId).fadeTo(200, 0.5);
	   }
	   if ($("#" + loginContainerId).is(":visible")) {
		   $("#" + loginContainerOverlayId).show();
		   $("#" + loginContainerId).fadeTo(200, 0.5);
	   }

      // 2018-10-02
      $("#" + loginContainerId).draggable({
         containment: 'window',           // 2018-10-06: move within the 'window' box
         handle: '#' + loginContainerId + '_TitleBar'
      });
      $("#" + dbCorpusListContainerId).draggable({
         containment: 'window',           // 2018-10-06: move within the 'window' box
         handle: '#' + dbCorpusListContainerId + '_TitleBar'
      });

      // uses jquery ajax for simplicity
      //$.ajaxSetup({async:false});
      $.ajaxSetup({xhrFields: { withCredentials: true } });
      var url = me.urlGetQueryResultDocumentsJson + "?target=" + target 
              + "&db=" + db + "&corpus=" + corpus + "&query=" + query
              + "&page=" + page + "&pageSize=" + pageSize 
              + (fieldsOnly ? "&fieldsOnly=" + fieldsOnly : "")    // 2018-09-14
              + (channelKey ? "&channelKey=" + channelKey : "");
      //var w = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);      // viewport width
      //var h = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
      //var scrollX = window.pageXOffset;
      //var scrollY = window.pageYOffset;
      //var x = evt.clientX;
      //var y = evt.clientY;
      //$("#" + loadingContainerId).show().css({top:myTop, left:myLeft}); 
      
      if (me.displayLoadingIcon) {
         $("#" + loadingContainerId).show().position({my: "left+25 top+25", at: "center bottom", of: evt, collision: "fit"});     // jqueryUI, 20170619: change "none" to "fit"
         $("#" + workingProgressId).html(message);
      }
      //alert(url);
	  
	   $.ajaxSetup({xhrFields: {withCredentials: true}});
      $.get(url, function(data) {		  
         $("#" + loadingContainerId).hide();
         if (data.code == 0) {                               // successfully get dbCorpusDocuments
            $("#" + dbCorpusListContainerId).fadeOut();
            var retChannelKey = data.message.channelKey;
            if (!retChannelKey) {
               // simple case: copy to object "global" area
               me.totalFound = data.message.totalFound;
               me.page = data.message.page;
               me.pageSize = data.message.pageSize;
               me.docList = data.message.docList.slice();          // 2017-01-17: copy value so that the caller can use it
               me.target = data.message.target;                    // 2016-05-02
               me.db = data.message.db;                            // should be equal to me.db
               me.corpus = data.message.corpus;                    // should be equal to me.corpus
               me.spotlights = data.message.spotlights;            // 2016-12-18
               me.fieldsInly = (data.message.fieldsOnly !== undefined)
                             ? data.message.fieldsOnly : '';       // 2018-09-15
               if (typeof me.callerCallback === "function") me.callerCallback(me.callerCallbackParameters);
            }
            else {
               // copy to object's specific variable (channel area)
               var ch = me.channelBuffer[retChannelKey];
               ch.query       = data.message.query;                // 2017-01-24
               ch.totalFound  = data.message.totalFound;
               ch.page        = data.message.page;
               ch.pageSize    = data.message.pageSize;
               ch.docList     = data.message.docList.slice();
               ch.target      = data.message.target;
               ch.db          = data.message.db;
               ch.corpus      = data.message.corpus;
               ch.spotlights  = data.message.spotlights;
               ch.fieldsInly  = (data.message.fieldsOnly !== undefined)
                              ? data.message.fieldsOnly : '';      // 2018-09-15
               if (typeof ch.callerCallback === "function") {
                  ch.callerCallback(retChannelKey, ch.callerCallbackParameters);
               }
            }
            
         }
         else if (data.code == 101) {             // requires login
			   $("#" + dbCorpusListContainerId).fadeOut();
            var jelement = $("#" + loginContainerId);
			   jelement.fadeTo(200, 1);
			   $("#" + loginContainerOverlayId).hide();
            jelement.position({my: "left top", at: "center bottom", of: evt, collision: "fit"});
         }
         else if (data.code == 201) {             // requires db and corpus => display db list for user to specify
            var param = { target: target,
                          invokeFunName: 'getDbCorpusDocumentsGivenPageAndSize'};
            if (fieldsOnly !== undefined) param.fieldsOnly = me.fieldsOnly;
            //console.log(param, me.callerEvent)
            displayDbCorpusList(param, me.callerEvent);
         }
         else {
			   $("#" + dbCorpusListContainerId).fadeOut();
            alert("Error: " + data.code + "\n" + data.message);
         }
      }, 'json');
   };
   
   me.getQueryPostClassification = function(param, evt, successFunc, successFuncParameters) {
      if (typeof(param) != 'object') param = {};
      target = ('target' in param) ? param.target : 'USER';
      db = ('db' in param) ? param.db : '';
      corpus = ('corpus' in param) ? param.corpus : '';
      query = ('query' in param) ? param.query : '.all';
      page = ('page' in param) ? param.page : 1;
      pageSize = ('pageSize' in param) ? param.pageSize : 50;
      fieldsOnly = ('fieldsOnly' in param) ? param.fieldsOnly : '';      // 2018-09-15
      message = ('message' in param) ? param.message : ('page: ' + page); 
	  
      me.callerEvent = evt;
      me.callerCallback = successFunc;
      me.callerCallbackParameters = successFuncParameters;
      me.target = target.toUpperCase();
      if (me.target != 'OPEN') me.target = 'USER';
      me.db = db;
      me.corpus = corpus;

      // many variables (e.g., dbCorpusListContainerId) are defined outside me function... cannot access directly?
      var dbCorpusListContainerId = me.idPrefix + "dbCorpusListContainer" + me.uniqueId;
      var dbCorpusListContainerOverlayId = me.idPrefix + "dbCorpusListContainerOverlay" + me.uniqueId;
      var dbCorpusListContainerId = me.idPrefix + "dbCorpusListContainer" + me.uniqueId;
      var loginContainerId = me.idPrefix + "loginContainer" + me.uniqueId;
      var loginContainerOverlayId = me.idPrefix + "loginContainerOverlay" + me.uniqueId;
      var loadingContainerId = me.idPrefix + "loadingContainer" + me.uniqueId;
      var workingProgressId = me.idPrefix + "workingProgressId" + me.uniqueId;
      
      // If Container is visible, adjust the opacity and block click events (by overlay layer)
	   if ($("#" + dbCorpusListContainerId).is(":visible")) {
		   $("#" + dbCorpusListContainerOverlayId).show();
		   $("#" + dbCorpusListContainerId).fadeTo(200, 0.5);
	   }
	   if ($("#" + loginContainerId).is(":visible")) {
		   $("#" + loginContainerOverlayId).show();
		   $("#" + loginContainerId).fadeTo(200, 0.5);
	   }

      // uses jquery ajax for simplicity
      //$.ajaxSetup({async:false});
      $.ajaxSetup({xhrFields: { withCredentials: true } });
      var url = me.urlGetQueryPostClassificationJson + "?target=" + target 
              + "&db=" + db + "&corpus=" + corpus + "&query=" + query
              + (fieldsOnly ? "&fieldsOnly=" + fieldsOnly : '');     // 2018-09-15

      if (me.displayLoadingIcon) {              
         $("#" + loadingContainerId).show().position({my: "left+25 top+25", at: "center bottom", of: evt, collision: "fit"});     // jqueryUI
         $("#" + workingProgressId).html(message);
      }
	  
	   //alert("=> " + url);
      $.ajaxSetup({xhrFields: {withCredentials: true}});
      $.get(url, function(data) {		  
         //alert(JSON.stringify(data));
         $("#" + loadingContainerId).hide();
         if (data.code == 0) {                               // successfully get dbCorpusDocuments
            $("#" + dbCorpusListContainerId).fadeOut();
            me.postClassification = data.message.postClassification;
            if (typeof me.callerCallback === "function") {
               me.callerCallback(me.callerCallbackParameters);
            }
         }
         else if (data.code == 101) {             // requires login
			   $("#" + dbCorpusListContainerId).fadeOut();
            var jelement = $("#" + loginContainerId);
			   jelement.fadeTo(200, 1);
			   $("#" + loginContainerOverlayId).hide();
            jelement.position({my: "left top", at: "center bottom", of: evt, collision: "fit"});
         }
         else if (data.code == 201) {            // requires db and corpus => display db list for user to specify
            var param = { target: target,
                          invokeFunName: 'getQueryPostClassification'}; 
            displayDbCorpusList(param, me.callerEvent);
         }
         else {
			   $("#" + dbCorpusListContainerId).fadeOut();
            alert("Error: " + data.code + "\n" + data.message);
         }
      }, 'json');
      //$.ajaxSetup({async:true});
   };
   
   me.getQueryTagAnalysis = function(param, evt, successFunc, successFuncParameters) {
      if (typeof(param) != 'object') param = {};
      target = ('target' in param) ? param.target : 'USER';
      db = ('db' in param) ? param.db : '';
      corpus = ('corpus' in param) ? param.corpus : '';
      query = ('query' in param) ? param.query : '.all';
      page = ('page' in param) ? param.page : 1;
      pageSize = ('pageSize' in param) ? param.pageSize : 50;
      fieldsOnly = ('fieldsOnly' in param) ? param.fieldsOnly : '';      // 2018-09-15
      message = ('message' in param) ? param.message : ('page: ' + page); 
	  
      me.callerEvent = evt;
      me.callerCallback = successFunc;
      me.callerCallbackParameters = successFuncParameters;
      me.target = target.toUpperCase();
      if (me.target != 'OPEN') me.target = 'USER';
      me.db = db;
      me.corpus = corpus;

      // many variables (e.g., dbCorpusListContainerId) are defined outside me function... cannot access directly?
      var dbCorpusListContainerId = me.idPrefix + "dbCorpusListContainer" + me.uniqueId;
      var dbCorpusListContainerOverlayId = me.idPrefix + "dbCorpusListContainerOverlay" + me.uniqueId;
      var dbCorpusListContainerId = me.idPrefix + "dbCorpusListContainer" + me.uniqueId;
      var loginContainerId = me.idPrefix + "loginContainer" + me.uniqueId;
      var loginContainerOverlayId = me.idPrefix + "loginContainerOverlay" + me.uniqueId;
      var loadingContainerId = me.idPrefix + "loadingContainer" + me.uniqueId;
      var workingProgressId = me.idPrefix + "workingProgressId" + me.uniqueId;
      
      // If Container is visible, adjust the opacity and block click events (by overlay layer)
	   if ($("#" + dbCorpusListContainerId).is(":visible")) {
		   $("#" + dbCorpusListContainerOverlayId).show();
		   $("#" + dbCorpusListContainerId).fadeTo(200, 0.5);
	   }
	   if ($("#" + loginContainerId).is(":visible")) {
		   $("#" + loginContainerOverlayId).show();
		   $("#" + loginContainerId).fadeTo(200, 0.5);
	   }

      // uses jquery ajax for simplicity
      //$.ajaxSetup({async:false});
      $.ajaxSetup({xhrFields: { withCredentials: true } });
      var url = me.urlGetQueryTagAnalysisJson + "?target=" + target 
              + "&db=" + db + "&corpus=" + corpus + "&query=" + query
              + (fieldsOnly ? "&fieldsOnly=" + fieldsOnly : '');     // 2018-09-15
      
      if (me.displayLoadingIcon) {              
         $("#" + loadingContainerId).show().position({my: "left+25 top+25", at: "center bottom", of: evt, collision: "fit"});     // jqueryUI
         $("#" + workingProgressId).html(message);
      }
	  
	   //alert(url);
      $.ajaxSetup({xhrFields: {withCredentials: true}});
      $.get(url, function(data) {		  
         $("#" + loadingContainerId).hide();
         if (data.code == 0) {                               // successfully get dbCorpusDocuments
            $("#" + dbCorpusListContainerId).fadeOut();
            me.tagAnalysis = data.message.tagAnalysis;
            if (typeof me.callerCallback === "function") {
               me.callerCallback(me.callerCallbackParameters);
            }
         }
         else if (data.code == 101) {             // requires login
			   $("#" + dbCorpusListContainerId).fadeOut();
            var jelement = $("#" + loginContainerId);
			   jelement.fadeTo(200, 1);
			   $("#" + loginContainerOverlayId).hide();
            jelement.position({my: "left top", at: "center bottom", of: evt, collision: "fit"});
         }
         else if (data.code == 201) {            // requires db and corpus => display db list for user to specify
            var param = { target: target,
                          invokeFunName: 'getQueryTagAnalysis'}; 
            displayDbCorpusList(param, me.callerEvent);
         }
         else {
			   $("#" + dbCorpusListContainerId).fadeOut();
            alert("Error: " + data.code + "\n" + data.message);
         }
      }, 'json');
      //$.ajaxSetup({async:true});
   };
   
   me.updateDocument = function(db, corpus, docInfo) {
      var my = me;
      if (!('docFilename' in docInfo)) {
         alert("Error: requires db, corpus, docFilename to update document content");
         return false;
      }
      
      var fd = new FormData();
      fd.append('db', db);
      fd.append('corpus', corpus);
      fd.append('json', JSON.stringify(docInfo));

      $.ajax({
         url: my.urlUpdateCorpusDocumentJson,
         data: fd,
         processData: false,      // tell jquery not to process data
         type: "post",
         //async: false,          // not supported in CORS (Cross-Domain Resource Sharing)
         contentType: false,      // set false to let jquery specify multipart parameter
         success: function(data, status, xhr) {
            if (data.code == 0) {          // successfully get db list
               alert(data.message);
            }
            else {
               alert("Upload Error: " + data.code + "\n" + data.message);
               $("#" + loadingContainerId).hide();           // 2017-05-11
            }
         },
         error: function(xhr, status, error) {
            //var err = eval("(" + xhr.responseText + ")");
            alert(error);
            $("#" + loadingContainerId).hide();              // 2017-05-11
            //ert(xhr.responseText);
         }
      });
   };

   //// 動態載入 utility functions
   // DH project
   // me.scriptPath = new Error().stack.match(/((http[s]?):\/\/([^\/]+)\/((.+)\/)?)([^\/]+\.js):/)[1];
   me.scriptPath = 'docusky/js.ui/';
   me.utility = docuskyWidgetUtilityFunctions;
   if (!me.initialized) init();

};

// ----------------------------------------------------------------------------------

var docuskyWidgetUtilityFunctions = {
   getUrlParameterVarValue: function(url, varname) {
      var p = url.indexOf('?');
      if (p == -1) return '';
      var urlVars = url.substr(p+1).split('&');

      for (i = 0; i < urlVars.length; i++) {
         var nameVal = urlVars[i].split('=');
         if (nameVal[0] === varname) {
            return nameVal[1] === undefined ? true : nameVal[1];
         }
      }
      return '';
   },
   
   //getScriptPath: function() {
   //   var ua = window.navigator.userAgent;
   //   var msie = ua.indexOf("MSIE ");
   //   if (msie) {
   //      // use fixed url
   //      var pathParts = "http://docusky.digital.ntu.edu.tw/docusky/js.ui/docusky.widget.utilityFunctions.js";
   //   }
   //   else {
   //      var errorStack = new Error().stack;
   //      var pathParts = errorStack.match(/((http[s]?):\/\/([^\/]+)\/((.+)\/)?([^\/]+\.js)):/);
   //   }
   //   return {
   //      fullPath: pathParts[1],
   //      protocol: pathParts[2],
   //      host: pathParts[3],
   //      path: pathParts[5],
   //      file: pathParts[6]
   //   };
   //},
   
   basename: function(path) {
      return path.replace(/.*[/]/, "");
   },

   dirname: function(path) {
      return path.match(/(.*)[/]/)[1];
   },
   
   uniqueId: (function() {
      var counter = 0;
      return function() {
         return "_" + counter++;
      }
   })(),
   
   getDateStr: function(d, separator) {
      if (typeof separator == "undefined") separator = '';
      var twoDigitsMonth = ("0" + (d.getMonth()+1)).slice(-2);      // slice(-2) to get last 2 chars
      var twoDigitsDay = ("0" + d.getDate()).slice(-2);
      var strDate = d.getFullYear() + separator + twoDigitsMonth + separator + twoDigitsDay;
      return strDate;
   },
   
   //copyArray: function(o) {
   //   var output, v, key;
   //   output = Array.isArray(o) ? [] : {};
   //   for (key in o) {
   //      v = o[key];
   //      output[key] = (typeof v === "object") ? this.copyArray(v) : v;
   //   }
   //   return output;
   //},

   displayJson: function(jsonObj) {
      //var jsonStr = $("pre").text();
      //var jsonObj = JSON.parse(jsonStr);
      var jsonPretty = JSON.stringify(jsonObj, null, '\t');
      alert(jsonPretty);
   },
   
   // 2017-01-01
   includeJs: function(url) {
      var script  = document.createElement('script');
      script.src  = url;
      script.type = 'text/javascript';
      script.defer = true;        // script will not run until after the page has loaded
      document.getElementsByTagName('head').item(0).appendChild(script);
   }
 
};

// 20170302, 20180319: CSS injection
$('head').append('<style id="dsw-simplecomboui">'
	+ 'div.dsw-container { position:absolute; border:#4F4F4F solid 3px; background-color:#EFEFEF; border-radius:4px; display:inline-block; font-family: "Arial","MingLiU"; font-size: 16px; z-index:1001 }'
	+ 'div.dsw-titleBar { background-color:#4F4F4F; color:white; z-index:1001; padding: 6px; line-height: 16px; }'
	+ 'div.dsw-containerContent { padding: 6px; overflow-x:hidden; overflow-y:auto; font-size:medium; z-index:1001 }'
	+ '.dsw-titleBar table,.dsw-containerContent table { width: 100%; line-height:1.3em; border-collapse: collapse; border-spacing:0; }'
	+ 'table.dsw-tableContentList { width:100%; margin-right: 16px; border-collapse: collapse; border-spacing: 0; font-size:medium; line-height:1.3em; color:#2F2F3F; }'
	+ 'tr.dsw-tr-contentlist:nth-child(even) { background: #DFDFDF; line-height:1.3em; }'
	+ 'tr.dsw-tr-contentlist:nth-child(odd)  { background: #FFFFFF; line-height:1.3em; }'
   + 'span.dsw-span-provider { padding-left:3px; padding-right:3px; color:#BBBBBB;}'
   + '.dsw-titleContainer { width:85%; padding: 0; }'
   + '.dsw-closeContainer { position: relative; text-align: right; direction: rtl; padding: 0; }'
   + '.dsw-span-listOption { cursor:pointer; background-color:#DFDFDF; color:#1F1F1F; display:inline-block; line-height:16px; white-space:nowrap; }'
   + '.dsw-titlename { display: inline-block; line-height: 16px; white-space: nowrap; }'
   + '.dsw-btn-close { display: inline-block; line-height: 16px; cursor: pointer; }'
   + '.dsw-btn-close:hover { background-color:#BFBFBF; color:#96438A; }'
   + '.dsw-btn-close:active { background-color:#BFBFBF; color:#96438A; }'
   + '.dsw-td-contentlist { vertical-align: middle; padding: 0.25rem;}'
   + '.dsw-td-contentlist-num { text-align: right;}'
   + '.dsw-a-switchProvider { cursor:pointer; text-decoration:underline; }'
   + '.dsw-useridContainer { display: inline-block; width: 50px; white-space: nowrap; overflow: visible; margin: 0 72px 0 0; }'
   + '.dsw-userid { display: inline-block; direction: ltr; }'
   + '.dsw-btn-logout { position: absolute; right: 0; top: -2px; color:#2F2F2F; background-color:#EFEFEF; border-radius: 3px; font-size: 0.75rem; line-height: 0.75rem; padding: 4px; margin: 0 24px 0 0; cursor: pointer; }'
   + '.dsw-btn-logout:hover { background-color:#BFBFBF; color:#96438A; }'
   + '.dsw-btn-logout:active { background-color:#BFBFBF; color:#96438A; }'
   + '.dsw-overlay { display: none; position: absolute; background-color: #AAAAAA; opacity: 0.5; z-index: 1003; height: 100%; width: 100%; }'
   + 'input[type="text"].dsw-userinput,input[type="password"].dsw-userinput { box-sizing: content-box; padding: 2px 8px; border: 1px solid grey; border-radius: 2px; font-size: 14px; height: 20px; width: 175px; }'
   + '.dsw-td-dslogin { padding: 0; height: 1.75rem; vertical-align: middle; }'
   + '.dsw-logintitle { padding-right: 6px; }'
   + '.dsw-loginsubmit { direction: rtl; }'
   + '.dsw-loginmsg { padding: 0; color: red; font-size: 12px; font-weight: bold; }'
   + 'span.dsw-listOpenCorpuses, span.dsw-listPersonalCorpuses { text-decoration:underline; cursor:pointer; }'         // 2018-09-30
   + 'table.dsw-filenameList { width: 100%; margin-right: 16px; border-collapse: collapse; border-spacing: 0; line-height: 1.25; }'
   + '.dsw-filenameList td { padding: 0.25rem; vertical-align: top; white-space: nowrap; }'
   + '.dsw-filenameList-id { text-align: right; }'
   + '.dsw-filename-download,.dsw-filename.delete { text-align: center; }'
   + '.dsw-filenameList-category,.dsw-filenameList-path { text-align: left; overflow-x: hidden; text-overflow: ellipsis; }'
   + '.dsw-filenameList-id {}'	// Let ID automatically adjust width
   + '.dsw-filenameList-download,.dsw-filenameList-delete { width: 45px; max-width: 45px; text-align: center; }'
   + '.dsw-filenameList-category { font-weight: bold; min-width: 120px; max-width: 150px; }'
   + '.dsw-filenameList-path { min-width: 450px; max-width: 550px; }'
   + '.table.dsw-uploadfile{ width: 100%; border-collapse: collapse; border-spacing: 0; }'
   + '.dsw-uploadfile td { padding: 0; }'
   + '.dsw-td-dbList { padding: 0.25rem; }'
   + '.dsw-td-dbList-dbname,.dsw-td-dbList-corpusnames{ text-align:left; border:1px solid #5C5C5C; }'
   + '.dsw-td-dbList-delete{ text-align: center;  border:1px solid #5C5C5C; }'
   + '.dsw-td-dbList-dbname{ font-weight:600; min-width: 100px; max-width:180px; word-wrap: break-word; word-break: break-all; }'
   + '.dsw-td-dbList-corpusnames{ min-width: 450px; max-width: 550px; }'
   + '.dsw-td-dbList-delete{ min-width:40px; max-width: 60px; white-space: nowrap; }'
   + '.dsw-dbList-corpusnames-corpusname { display: inline-block; vertical-align: middle; white-space: nowrap; max-width: 250px; overflow-x: hidden; text-overflow: ellipsis; }'
   + '.dsw-uploadprogressbar { display: none; box-sizing: border-box; height: 20px; width: 100%; margin: 0; padding: 0; border: 1px solid #515F6B; border-radius: 3px; overflow: hidden; background-color: #AFB9C3; }'
   + '.dsw-uploadprogressbar-progress { display: block; height: 100%; margin: 0; padding: 0; border: 0; background-color: #4C93D4; text-align: center; color: white; white-space: nowrap; }'
   + 'span.dsw-dbClick { cursor:pointer; text-decoration:underline; color:blue; }'
   + 'span.dsw-corpusAttCntClick { cursor:pointer; text-decoration:underline; color:blue; }'
   + 'span.dsw-corpusClick { cursor:pointer; text-decoration:underline; color:blue; }'
   + 'span.dsw-attCntClick { cursor:pointer; text-decoration:underline; color:blue; }'
   + '</style>'
);

// ----------------------------------------------------------------------------------
// initialize widget
var docuskyGetDbCorpusDocumentsSimpleUI = new ClsDocuskyGetDbCorpusDocumentsSimpleUI();
