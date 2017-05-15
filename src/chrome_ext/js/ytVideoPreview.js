/**
 * Youtube Video Preview
 * @author Paul Comanici (darkyndy) <darkyndy@gmail.com>
 * @requires DyDomHelper
 * @requires ytConst.js
 *
 */
/*jslint browser: true, devel: true */
(function () {
  'use strict';

  const ytVideoPreview = {};

// configuration of the observer: (on node changes)
  ytVideoPreview.nodeObserverConfig = {
    attributes: false,
    childList: true,
    characterData: false,
  };

// configuration of the observer: (on attribute changes)
  ytVideoPreview.attrObserverConfig = {
    attributes: true,
    childList: false,
    characterData: false,
  };

  ytVideoPreview.mutationCb = (mutations) => {
    mutations.forEach(ytVideoPreview.thumbnailChanges);
  };

  ytVideoPreview.thumbnailChanges = (mutation) => {
    const el = mutation.target;
    my.delegateOnVideoThumb([el]);
  };

  ytVideoPreview.elementAttrObserver = new MutationObserver(ytVideoPreview.mutationCb);

  ytVideoPreview.getThumbnailEl = (matchedEl) => {
    let thumbnailEl = null;
    if (matchedEl.children && matchedEl.children.thumbnail) {
      thumbnailEl = matchedEl.children.thumbnail;
    }

    return thumbnailEl;
  };

  ytVideoPreview.getVideoIdFromLink = (videoLink) => {
    let videoId = '';
    if (videoLink && videoLink.length > 0) {
      const videoIdRegExp = new RegExp('v=' + my.videoIdReg, 'i');
      if (videoLink.match(videoIdRegExp)) {
        const videoRegRez = videoIdRegExp.exec(videoLink);
        videoId = videoRegRez[1];
      }
    }

    return videoId;
  };

  ytVideoPreview.getVideoIdFromLinkElement = (videoEl) => {
    const videoLink = videoEl.getAttribute('href');

    const videoId = ytVideoPreview.getVideoIdFromLink(videoLink);

    return videoId;
  };

  ytVideoPreview.testVideoForRating = (videoEl) => {
    let continueTest = false;
    let parentEl;

    if (videoEl && videoEl.parentNode) {
      // element where rating element will be inserted (parentEl)
      parentEl = videoEl.parentNode;
      const nodeName = parentEl.nodeName;
      if (nodeName === 'YTD-THUMBNAIL') {
        continueTest = true;
      }
    }

    // separation (for multiple conditions)
    if (continueTest) {
      const videoId = ytVideoPreview.getVideoIdFromLinkElement(videoEl);

      if (videoId) {
        if (!my.appendRatingObj[videoId]) {
          my.appendRatingObj[videoId] = {};
        }
        my.appendRatingObj[videoId].parentEl = parentEl;
        my.retrieveVideoDataDebounced();
      }
    }
  };


  /*global setTimeout, DyDomHelper, XMLHttpRequest, chrome, self, PROPR_VIEW_RATING, PROPR_IMAGE_TIME, PROPR_RATING_HEIGHT, PROPR_RATING_LIKE_COLOR, PROPR_RATING_DISLIKE_COLOR */
  var my;
  my = {
    defaultImg: 'default',        //default image name
    defaultImgWidth: 120,         //default image with
    baseImgPath: '//i.ytimg.com/vi', //base image path
    maxTestNr: 5,                 //maximum number of test to be executed on element
    hoverTimer: null,             //timer when hovering image
    hoverVideoId: '',             //video id of hovering image
    videoImgIdNr: 1,              //unique number that will be added to image id attribute
    videoImgData: {},             //object with video images data
    videoIdReg: '([a-z0-9-_=]+)', //regular expression for video id
    ratingAddedCssClass: '',      //css class added to elements that contain video and they have rating
    knownAddedCssClass: '',       //css class added to elements that are known to have video, only if element was already parsed
    validVideoCssClass: 'YtPreviewValid', //css class added on img element, only for videos for thumbnail preview
    settings: {},                         //settings object for extension
    usedPrefix: 'ytVideoPreview', //prefix used for dataset
    appendRatingObj: {},
    debounce: function (func, wait) {
      var timeout;
      return function () {
        var context = this;
        clearTimeout(timeout);
        timeout = setTimeout(function () {
          timeout = null;
          func.apply(context, []);
        }, wait);
        if (!timeout) {
          func.apply(context, []);
        }
      };
    },
    /**
     * @description Get property name
     *   This is used to add prefix for each property so will not break YouTube UI
     * @param {String} propr
     */
    getProprName: function (propr) {
      var proprName;
      //propr = propr.charAt(0).toUpperCase() + propr.substr(1, propr.length);
      proprName = my.usedPrefix + propr;
      return proprName;
    },
    /**
     * @description Filter CSS property by setting to integer
     * @param {String} propVal
     */
    cssPropAsInt: function (propVal) {
      propVal = parseInt(propVal, 10);
      if (isNaN(propVal)) {
        propVal = 0;
      }
      return propVal;
    },
    addRatingCssClassToBody: function () {
      if (my.settings[PROPR_VIEW_RATING]) {
        //ok, rating preview is enabled, add on body class for rating active
        document.body.classList.add(my.ratingAddedCssClass);
      }
    },
    populateVideoRating: function (videoId) {
      var positiveRatio,
        negativeRatio,
        ratingEl,
        ratingElHtml,
        ratingElCssClass,
        likes,
        dislikes,
        ratingCount;
      if (videoId && my.appendRatingObj[videoId]) {
        likes = parseInt(my.appendRatingObj[videoId].likeCount, 10); //be sure is integer
        dislikes = parseInt(my.appendRatingObj[videoId].dislikeCount, 10); //be sure is integer
        ratingCount = likes + dislikes;
        if (!isNaN(likes) && !isNaN(ratingCount) && ratingCount > 0) {
          if (my.appendRatingObj[videoId].parentEl) {
            //continue only if we have parentEl
            ratingElCssClass = my.getProprName('-ratingContainer');
            ratingEl = my.appendRatingObj[videoId].parentEl.querySelector('.' + ratingElCssClass);
            if (!ratingEl) {
              //in case rating element was not added
              positiveRatio = likes * 100 / ratingCount;
              positiveRatio = Math.round(positiveRatio * 100) / 100;
              negativeRatio = 100 - positiveRatio;
              negativeRatio = Math.round(negativeRatio * 100) / 100;
              ratingEl = DyDomHelper.createEl('div',
                {'class': ratingElCssClass + ' ' + my.getProprName('-ratingHeight' + my.settings[PROPR_RATING_HEIGHT]) });
              ratingElHtml = '<DIV ' +
                'class="' + my.getProprName('-ratingLikes') + '" ' +
                'title="' + likes + ' likes from ' + ratingCount + ' rating (' + positiveRatio + '%)' + '" ' +
                'style="width: ' + positiveRatio + '%; background: ' + my.settings[PROPR_RATING_LIKE_COLOR] + ';"></DIV>' +
                '<DIV ' +
                'class="' + my.getProprName('-ratingDislikes') + '" ' +
                'title="dislikes: ' + negativeRatio + '%' + '" ' +
                'style="width: ' + negativeRatio + '%; background: ' + my.settings[PROPR_RATING_DISLIKE_COLOR] + ';"></DIV>';
              ratingEl.innerHTML = ratingElHtml;
              my.appendRatingObj[videoId].parentEl.appendChild(ratingEl); //now add rating in page
            }
          }
        }
      }
    },
    /**
     *
     * @description Add video rating
     * @param {Object} resp
     * @param {HTMLElement} parentEl
     */
    appendRating: function (resp) {
      var i,
        respItemsLength,
        videoId;
      try {
        resp = JSON.parse(resp);
      } catch (ex) {
        //console.log(ex.message);
      }
      if (resp && resp.items && resp.items.length > 0) {
        //response has video items
        respItemsLength = resp.items.length;
        for (i = 0; i < respItemsLength; i += 1) {
          videoId = resp.items[i].id;
          if (videoId && my.appendRatingObj[videoId] && my.appendRatingObj[videoId].parentEl) {
            //add rating data to local object
            my.appendRatingObj[videoId].likeCount = resp.items[i].statistics.likeCount;
            my.appendRatingObj[videoId].dislikeCount = resp.items[i].statistics.dislikeCount;
          }
          //now set rating for video
          my.populateVideoRating(videoId);
        }
      }
    },
    /**
     *
     * @description Ajax request
     * @param {String} reqMethod
     * @param {String} reqUrl
     * @param {String} reqData
     * @param {Array} cbParams
     * @param {Function} successFn
     * @param {Function} errorFn
     */
    doAjaxRequest: function (reqMethod, reqUrl, reqData, cbParams, successFn, errorFn) {
      var xhr,
        aSync = true,
        noCache = false,
        concatString;
      cbParams = cbParams || [];
      try {
        xhr = new XMLHttpRequest(); //FireFox, Safari, Chrome, Opera ...
      } catch (e) {
        //console.log(e.message);
      }
      if (xhr) {
        xhr.onreadystatechange = function () {
          if (xhr.readyState === 4) {
            if (xhr.status === 200) {
              //XHR request is ok
              if (successFn) {
                cbParams.unshift(xhr.responseText);
                successFn.apply(null, cbParams);
                cbParams.shift(); //remove first element
              }
            } else {
              //ERROR
              if (errorFn) {
                errorFn(xhr.status);
              }
            }
          }
        };
        try {
          concatString = '?';
          if (noCache === true) {
            reqUrl = reqUrl + '?_dy_no_cache__' + (new Date()).getTime();
            concatString = '&';
          }
          if (reqMethod.toUpperCase() === 'GET') {
            reqUrl = reqUrl + concatString + reqData;
            reqData = null;
          }
          xhr.open(reqMethod, reqUrl, aSync);
          //xhr.setRequestHeader('Content-type', 'application/json', true);
          try {
            xhr.send(reqData);
          } catch (eS) {
            //we have error when sending request
            //console.log(eS.message);
          }
        } catch (eL) {
          //we have error when loading request
          //console.log(eL.message);
        }
      } else {
        //cannot execute request
        console.log('Cannot initialize XHR request');
      }
    },
    /**
     *
     * @description Retrieve video data
     */
    retrieveVideoData: function () {
      var reqUrl,
        reqData,
        videoIds,
        videoIdsString,
        tempVideoIds;
      videoIds = Object.keys(my.appendRatingObj);
      if (videoIds.length > 0) {
        //API doesn't support more then 50 id's so make sure to send maximum 50
        do {
          tempVideoIds = videoIds.splice(0, 50);
          videoIdsString = tempVideoIds.join(',');
          reqUrl = 'https://www.googleapis.com/youtube/v3/videos/';
          reqData = 'part=statistics&id=' + videoIdsString + '&key=AIzaSyAKHgX0wWr82Ko24rnJSBqs8FFvHns21a4';
          my.doAjaxRequest('GET', reqUrl, reqData, [], my.appendRating);
        } while (videoIds.length !== 0);
      }
      //reqUrl = 'http://gdata.youtube.com/feeds/api/videos/' + videoId;
      //reqData = 'v=2&prettyprint=false&alt=jsonc';
    },
    /**
     *
     * @description Before testing video for rating and adding it, do basic validation
     *   - rating preview is enabled;
     *   - element was already parsed
     * @param {HTMLElement} videoThumbEl
     */
    beforeTestVideoForRating: function (videoThumbEl) {
      var videoThumbClassList;
      if (my.settings[PROPR_VIEW_RATING]) {
        // ok, rating preview is enabled
        videoThumbClassList = videoThumbEl.classList;
        if (!videoThumbClassList.contains(my.ratingAddedCssClass)) {
          // ok, element was not parsed for video rating preview
          videoThumbClassList.add(my.ratingAddedCssClass);
        }
        // TODO: this part should be improved (less checking)
        // now test if we can apply rating to it
        ytVideoPreview.testVideoForRating(videoThumbEl);
      }
    },
    getNewImagePath: function (imgData, videoId, imgName) {
      return my.baseImgPath + imgData.pathData + '/' + videoId + '/' + imgName + imgData.imgExt;
    },
    /**
     *
     * @description Set default image
     * @param {HTMLElement} imgEl
     * @param {String} videoId
     * @param {String} videoImgElId
     */
    setDefaultImg: function (imgEl, videoId, videoImgElId) {
      var imgData;
      imgData = my.videoImgData[videoImgElId];
      if (imgData) {
        //only if we have data stored for video
        imgEl.setAttribute('src', my.getNewImagePath(imgData, videoId, imgData.imgDefault));
        imgData.imgIndex = 0;
        window.clearTimeout(my.hoverTimer);
      }
    },
    /**
     *
     * @description Switch image for video preview
     * @param {HTMLElement} imgEl
     * @param {String} videoId
     * @param {String} videoImgElId
     */
    switchVideoImg: function (imgEl, videoId, videoImgElId) {
      var imgData,
        imgId,
        newImgSrc,
        imgCached;
      if (my.hoverTimer !== null) {
        window.clearTimeout(my.hoverTimer);
      }
      if (my.hoverVideoId !== videoId) {
        if (my.hoverVideoId === '') {
          //this means that rotate image was in loop
          my.setDefaultImg(imgEl, videoId, videoImgElId);
        } else {
          videoId = my.hoverVideoId;
        }
      }
      imgData = my.videoImgData[videoImgElId];
      imgId = imgData.imgIndex + 1;
      if (imgId > 3) {
        imgId = 1;
      }

      if (videoId) {
        if (imgData.correctExtension === false) {
          //if we couldn't find correct extension ... don't try any more
          return;
        }
        newImgSrc = my.getNewImagePath(imgData, videoId, imgId);
        imgEl.setAttribute('src', newImgSrc);
        if (!imgData.correctExtension) {
          //start image caching, used for fixing image extension
          imgCached = new Image();
          imgCached.onload = function () {
            imgData.correctExtension = true;
          };
          imgCached.onerror = function () {
            if (imgData.imgExt === '.jpg') {
              imgData.imgExt = '.webp';
              imgData.pathData = '_webp';
            } else if (imgData.imgExt === '.webp') {
              imgData.imgExt = '.jpg';
              imgData.pathData = '';
            } else {
              imgData.correctExtension = false;
            }
          };
          imgCached.src = newImgSrc;
        }

        // TODO: show also image number while hovering (indication of thumbnail number)

        imgData.imgIndex = imgId;
        my.hoverTimer = setTimeout(my.switchVideoImg, my.settings[PROPR_IMAGE_TIME], imgEl, videoId, videoImgElId);
      }
    },
    /**
     *
     * @description Test if image element is for a video
     * @param {HTMLElement} videoImgEl
     * @param {String} actType
     */
    testVideoImg: function (videoImgEl, actType) {
      var testNr,              //store number of tests made for a specific video
        testNrAttr,
        initImgRegExp,       //reg exp to find videoId, for jpg image
        rezReg,
        initImg,
        videoId,
        videoImgElId,
        imgData;

      let regMatch = false;

      testNrAttr = my.getProprName('TestNr');
      testNr = videoImgEl.getAttribute(testNrAttr) || 0;
      testNr = parseInt(testNr, 10);
      if (isNaN(testNr)) {
        testNr = 0;
      }
      testNr = testNr + 1;
      if (my.maxTestNr > testNr) {
        //if we didn't reached maximum number of tests
        videoImgEl.setAttribute(testNrAttr, testNr);
        initImg = videoImgEl.getAttribute('src');
        if (!initImg) {
          // get video A element (parent)
          const videoEl = videoImgEl.parentElement.parentElement;
          const videoId = ytVideoPreview.getVideoIdFromLinkElement(videoEl);
          if (videoId) {
            // if we found videoId on parent, reset test to 0, in the end we will have src for img element
            testNr = 0;
          }
        } else {
          //default reg exp for a video thumb
          initImgRegExp = new RegExp('vi(_webp)*\\/' + my.videoIdReg + '\\/([a-z]*)(default)\\.([a-z]+)*', 'i');
          if (initImg.match(initImgRegExp)) {
            regMatch = true;
          }
        }

        if (regMatch) {
          rezReg = initImgRegExp.exec(initImg);
          if (rezReg.length === 6) {
            videoId = rezReg[2];
            if (videoId !== 'undefined') {
              //continue only if videoId is not 'undefined'
              const attrName = my.getProprName('-id');
              videoImgElId = videoImgEl.getAttribute(attrName); //get image element ytVideoPreview-id attribute
              if (!videoImgElId) {
                //if image element doesn't have id attribute then generete and add one
                videoImgElId = my.getProprName('Id' + my.videoImgIdNr);
                my.videoImgIdNr += 1;
                videoImgEl.setAttribute(attrName, videoImgElId);
              }
              //build object with video data
              imgData = {};
              imgData.videoId = videoId;
              imgData.pathData = rezReg[1] || '';
              imgData.imgIndex = 0;
              imgData.imgDefault = rezReg[3] + rezReg[4];
              imgData.imgExt = '.' + rezReg[5];
              my.videoImgData[videoImgElId] = imgData;
              videoImgEl.setAttribute(my.getProprName('Parsed'), 'true');
              my.initVideoSettings(actType, videoImgEl);
            }
          }
        } else {
          //console.log('no match at reg for: ' + initImg + ' , testNr: ' + testNr);
          //try again image test
          setTimeout(my.testVideoImg, 100, videoImgEl, actType);
        }
      } else {
        if (my.maxTestNr >= testNr) {
          testNr += 1;
          videoImgEl.setAttribute(testNrAttr, `${testNr}`);
        }
      }
    },
    /**
     *
     * @description Initialize video settings
     * @param {String} actType
     * @param {HTMLElement} videoImgEl
     */
    initVideoSettings: function (actType, videoImgEl) {
      var imgData,
        settingsParsed,
        parsedAttr,
        videoId,
        videoImgElId;
      parsedAttr = my.getProprName('Parsed');
      settingsParsed = videoImgEl.getAttribute(parsedAttr);
      if (settingsParsed && (settingsParsed === 'true' || settingsParsed === true)) {
        settingsParsed = true;
      } else {
        settingsParsed = false;
      }
      //console.log(settingsParsed);
      if (settingsParsed === true) {
        const attrName = my.getProprName('-id');
        videoImgElId = videoImgEl.getAttribute(attrName);
        if (videoImgElId) {
          imgData = my.videoImgData[videoImgElId];
          videoId = imgData.videoId;
          if (actType === 'in') {
            if (my.hoverVideoId !== videoId) {
              //we switched to another video images
              my.hoverVideoId = videoId;
              my.switchVideoImg(videoImgEl, videoId, videoImgElId);
            }
          } else {
            my.setDefaultImg(videoImgEl, videoId, videoImgElId);
            my.hoverVideoId = '';
          }
        }
      } else {
        my.testVideoImg(videoImgEl, actType);
      }
    },
    /**
     *
     * @description Function executed when user enters video element
     * Note: don't call evt.stopPropagation() as it will block YouTube showing add to quick list
     * @param {Event} evt
     */
    mouseEnterVideo: function (evt) {
      var videoImgEl;
      //console.log('hover in');
      videoImgEl = this.querySelector('img');
      my.initVideoSettings('in', videoImgEl);
      my.beforeTestVideoForRating(this);
    },
    /**
     *
     * @description Function executed when user exits video element
     * @param {Event} evt
     */
    mouseExitVideo: function (evt) {
      var videoImgEl,
        targetEl;
      //console.log('hover out');
      targetEl = evt.toElement || evt.relatedTarget;
      if (targetEl) {
        if (targetEl === this || targetEl.parentNode === this ||
            targetEl.parentNode.parentNode === this ||
            targetEl.parentNode.parentNode.parentNode === this) {
          return;
        }
      }
      videoImgEl = this.querySelector('img');
      my.initVideoSettings('out', videoImgEl);
      evt.stopPropagation();
    },
    /**
     *
     * @description Attach mouse event for video thumb
     * @param {Array} videoEls
     */
    delegateOnVideoThumb: function (videoEls) {
      var videoElsMaxIndex,
        videoEl,
        i,
        wasParsed;
      videoElsMaxIndex = videoEls.length - 1;

      for (i = videoElsMaxIndex; i >= 0; i = i - 1) {
        videoEl = videoEls[i];
        let linkVideoEl;
        const videoElNode = videoEl.nodeName;
        if (videoElNode === 'YTD-THUMBNAIL') {
          // parent element
          const thumbnailEl = ytVideoPreview.getThumbnailEl(videoEl);
          if (thumbnailEl) {
            linkVideoEl = thumbnailEl;
          }
        } else if (videoElNode === 'A') {
          linkVideoEl = videoEl;
        }

        if (linkVideoEl) {
          wasParsed = DyDomHelper.hasClass(linkVideoEl, my.knownAddedCssClass);

          if (!wasParsed) {
            linkVideoEl.classList.add(my.knownAddedCssClass);

            if (linkVideoEl.offsetWidth === 0 || linkVideoEl.offsetWidth > 50) {
              //if element has 0 OR at least 50 px in width then continue,
              //there are elements hidden => take them in consideration
              //there are elements that match selector and have 18, 32 or 48 px in width => ignore
              linkVideoEl.addEventListener('mouseover', my.mouseEnterVideo, false);
              linkVideoEl.addEventListener('mouseout', my.mouseExitVideo, false);
            }
          }
          my.beforeTestVideoForRating(linkVideoEl);
        }
      }
    },
    /**
     *
     * @description Attach mouse event for video
     * @param eventOnEl
     */
    delegateMouseEvt: function (eventOnEl) {
      if (!eventOnEl) {
        eventOnEl = document.getElementById('body-container');
        if (!eventOnEl) {
          eventOnEl = document;
        }
      }

      my.delegateOnVideoThumb(eventOnEl.getElementsByTagName('ytd-thumbnail'));

    },
    /**
     *
     * @description Test for new video inserted in page
     * @param {Event} evt
     */
    testForNewVideo: function (evt) {
      // el ytd-thumbnail & child with class ytd-thumbnail (el as a)
      let matchedEls = [];

      const el = evt.target;
      const nodeType = el.nodeType;
      if (nodeType === Node.ELEMENT_NODE) {
        matchedEls = el.getElementsByTagName('ytd-thumbnail');
      }

      const matchedElsLength = matchedEls.length;
      if (matchedElsLength) {

        my.delegateOnVideoThumb(matchedEls);

        for (let i = 0; i < matchedElsLength; i += 1) {
          const matchedEl = matchedEls[i];
          const thumbnailEl = ytVideoPreview.getThumbnailEl(matchedEl);
          if (thumbnailEl) {
            ytVideoPreview.elementAttrObserver.observe(thumbnailEl, ytVideoPreview.attrObserverConfig);
          }

        }

        my.addRatingCssClassToBody();
      }
    },
    /**
     *
     * @description Attach events for page
     */
    delegateForPage: function () {
      document.addEventListener("DOMNodeInserted", my.testForNewVideo, true);
      my.delegateMouseEvt();
    },
    /**
     *
     * @description Parse response at get settings
     * @param {Object} response
     */
    parseResponseAtGetSettings: function (response) {
      //console.log(response);
      if (typeof response === 'object') {
        if (response.settings) {
          my.init(response.settings);
        }
      }
    },
    setExtensionStyle: function (fileName) {
      var stylesheet = document.createElement('link');
      stylesheet.setAttribute('rel', 'stylesheet');
      stylesheet.setAttribute('href', fileName);
      stylesheet.setAttribute('type', 'text/css');
      document.getElementsByTagName('head')[0].appendChild(stylesheet);
    },
    /**
     *
     * @description Called when a message is passed.
     * @param {Object} request
     * @param sender
     * @param {Function} sendResponse
     */
    onRequest: function (request) {
      var proprName,
        newValue,
        response,
        message;
      if (typeof request === 'object') {
        if (request.message) {
          message = request.message;
          response = request.response;
          if (message === 'updateSettings') {
            newValue = response.newValue;
            proprName = response.proprName;
            if (proprName === PROPR_VIEW_RATING) {
              if (newValue === false || newValue === 'false') {
                newValue = false;
              } else {
                newValue = true;
              }
            } else if (proprName === PROPR_IMAGE_TIME) {
              newValue = parseInt(newValue, 10);
            }
            my.settings[proprName] = newValue;
          } else if (message === 'setSettings') {
            my.parseResponseAtGetSettings(response);
          } else if (message === 'setStyle') {
            my.setExtensionStyle(response.file);
          }
        }
      }
    },
    /**
     *
     * @description Attach events for extension
     */
    delegateForExtension: function () {
      if (window.chrome && chrome.extension) {
        chrome.extension.sendMessage('showAction');
        chrome.extension.sendMessage('getSettings');
        chrome.extension.onMessage.addListener(my.onRequest);
      } else if (self) {
        self.postMessage('getStyle');
        self.postMessage('getSettings');
        self.on('message', my.onRequest);
      }
    },
    /**
     * @description Initialize extension properties
     */
    initPropr: function () {
      my.ratingAddedCssClass = my.getProprName('-ratingActive');
      my.knownAddedCssClass = my.getProprName('-videoKnown');
      my.addRatingCssClassToBody();
    },
    /**
     * @description Initialize youtube video preview for page
     * @param {Object} settings
     */
    init: function (settings) {
      my.settings = settings;
      my.initPropr();
      my.retrieveVideoDataDebounced = my.debounce(my.retrieveVideoData, 20);
      my.delegateForPage();
    }
  };
  my.delegateForExtension();
}());