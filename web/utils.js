/*
 * CDDL HEADER START
 *
 * The contents of this file are subject to the terms of the
 * Common Development and Distribution License (the "License").
 * You may not use this file except in compliance with the License.
 *
 * See LICENSE.txt included in this distribution for the specific
 * language governing permissions and limitations under the License.
 *
 * When distributing Covered Code, include this CDDL HEADER in each
 * file and include the License file at LICENSE.txt.
 * If applicable, add the following below this CDDL HEADER, with the
 * fields enclosed by brackets "[]" replaced with your own identifying
 * information: Portions Copyright [yyyy] [name of copyright owner]
 *
 * CDDL HEADER END
 */

/*
 * Copyright (c) 2009, 2015, Oracle and/or its affiliates. All rights reserved.
 */

(function(window, $){
    /*
     * DiffJumper module
     * 
     * called for example like
     * $("#difftable").diffTable(options)
     * where options are
     * {
     *  $parent: // jQuery object for common anchestor of all diff features
     *  $content: // jQuery object which is anchestor and scrollable - fixing animation
     *  chunkSelector: // String describing chunk selection
     *  addSelector: // String describing added lines
     *  delSelector: // String describin deleted lines
     *  $toggleButton: // jQuery object of button to toggle the jumper window
     *  animationDuration: // duration of toggling the jumper window
     * }
     */
    var diff = function($parent, options) {
        var inner = {
            initialized: false,
            currentIndex: -1,
            $changes: $(),
            options: {},
            defaults: {
                $parent: $("#difftable"),
                $content: $("#content"), //first scrollable div
                chunkSelector: ".chunk",
                addSelector: ".a",
                delSelector: ".d",
                $toggleButton: $("#toggle-jumper"),
                animationDuration: 500
            },
            /*
             * Whole panel looks like this in code
             * Other css rules are described in style.css
             * <div class="diff_navigation">
             *  <div class="header">
             *      <span class="prev summary">4/30 chunks</span>
             *      <a href="#" class="minimize">_</a>
             *  </div>
             *  <div class="controls">
             *      <a href="#" class="prev">&lt;&lt; Previous</a>
             *      <a href="#" class="next">Next &gt;&gt;</a>
             *  </div>
             *  <div class="progress">
             *  </div>
             *  <div class="errors">
             *  </div>
             * </div>
             */
            $panel: null,
            $summary: null,
            $errors: null,
            $progress: null,
            scrollTop: function (top) {
                $('*').scrollTop(top);                             
            },
            prevHandler: function (e) {
                e.preventDefault()

                inner.initChanges();

                var $current = $(inner.$changes[inner.currentIndex - 1])

                if(!$current.length) {
                    inner.$errors.error ( "No previous chunk!" )
                    return false
                }

                inner.currentIndex --;    
                
                inner.$progress.progress("Going to chunk " + (inner.currentIndex+1) + "/" + inner.$changes.length )

                inner.scrollTop($current.offset().top - inner.options.$parent.offset().top);
                
                inner.$summary.trigger("diff.summary.refresh");
                
                return false
            },
            nextHandler: function(e) {
                e.preventDefault()
                
                inner.initChanges();

                var $current = $(inner.$changes[inner.currentIndex + 1])

                if(!$current.length) {
                    inner.$errors.error ( "No next chunk!" )
                    return false
                }
                
                inner.currentIndex ++;        
                                
                inner.$progress.progress("Going to chunk " + (inner.currentIndex+1) + "/" + inner.$changes.length )
                
                inner.scrollTop($current.offset().top - inner.options.$parent.offset().top);
                
                inner.$summary.trigger("diff.summary.refresh");
                
                return false
            },               
            createPanel: function(){
                inner.$panel = $("<div></div>")
                            .appendTo($("body"))
                            .addClass("diff_navigation_style")
                            .addClass("diff_navigation")
                            .hide()

                inner.createHeader()
                inner.createButtons()
                inner.createProgress()
                inner.createErrors()
            },
            createHeader: function() {
                var $cancel = $("<a href='#' class='minimize'>_</a>")
                        .click(function(e){
                            inner.$panel.stop().animate({
                                top: inner.options.$content.scrollTop() + 
                                     inner.options.$toggleButton.offset().top,
                                left: inner.options.$toggleButton.offset().left + 
                                      inner.options.$toggleButton.width(),
                                opacity: 0
                            }, inner.options.animationDuration, function() {
                                inner.$panel.hide()
                                inner.options.$toggleButton.data("animation-in-progress", null );
                            });
                            inner.options.$toggleButton.data("animation-in-progress", "hiding" );
                        });
                inner.$summary = $("<span class='prev summary'></span>")
                        .text(inner.$changes.length + " chunks")
                        .bind("diff.summary.refresh", function (e) {
                                var index = inner.currentIndex < 0 ? 1 : ( inner.currentIndex + 1 );
                                $(this).text ( index + "/" + inner.$changes.length + " chunks" ) 
                             });
                
                var $controls = $("<div class=\"header\"></div>")
                $controls.append(inner.$summary)
                $controls.append($cancel)
                inner.$panel.append($controls)
            },
            createButtons: function() {
                var $prev = $("<a href='#' class='prev' title='Jump to previous chunk (shortcut b)'><< Previous</a>")
                        .click(inner.prevHandler)
                var $next = $("<a href='#' class='next' title='Jump to next chunk (shortcut n)'>Next >></a>")
                        .click(inner.nextHandler)

                var $controls = $("<div class=\"controls\"></div>")
                $controls.append($prev)
                $controls.append($next)
                inner.$panel.append($controls)
            },
            createErrors: function(){
                var $errors = $("<div class=\"errors\"></div>")
                $errors.error = function(str) {
                    var $span = $("<p class='error'>" + str + "</p>")
                            .animate({opacity: "0.2"}, 3000)
                    $span.hide('slow', function(){ $span.remove(); });

                    $errors.html($span)
                }                
                inner.$panel.append($errors)
                inner.$errors = $errors
            },
            createProgress: function(){
                var $progress = $("<div class=\"progress\"></div>")
                $progress.progress = function(str) {
                    var $span = $("<p>" + str + "</p>")
                            .animate({opacity: "0.2"}, 1000)
                    $span.hide('fast', function(){ $span.remove(); });
                    $progress.html($span)
                    inner.$errors.html("")
                }
                inner.$panel.append($progress)   
                inner.$progress = $progress
            },
            initChanges: function(){
                if(inner.$changes.length)
                    return
                // is diff in table (udiff/sdiff) or just html text (new/old diff)?
                var isTable = inner.options.$parent.find("table").length > 0
                // get all changes
                inner.$changes = isTable ? inner.options.$parent.find(inner.options.chunkSelector) : 
                           inner.options.$parent.find(inner.options.addSelector + "," + inner.options.delSelector)
                   
                inner.$summary.trigger("diff.summary.refresh");
            },
            init: function(){
                inner.createPanel();
                // set initial position by the toggle button
                inner.options.$toggleButton.each(function(){
                    inner.$panel.css({
                            top: $(this).offset().top,
                            left: $(this).offset().left + $(this).width(),
                            opacity: 0
                        }).hide();                  
                });
                // bind animation features
                inner.options.$toggleButton.click(function(e){
                   inner.initChanges();
                   var flag = $(this).data("animation-in-progress");
                   if(flag == "showing") {
                        inner.$panel.stop().animate({
                            top: inner.options.$content.scrollTop() +
                                 $(this).offset().top,
                            left: $(this).offset().left + $(this).width(),
                            opacity: 0
                        }, inner.options.animationDuration, function() {
                            inner.$panel.hide()
                            $(this).data("animation-in-progress", null );
                        });
                        $(this).data("animation-in-progress", "hiding" );
                   } else {
                        inner.$panel.stop().show().animate({
                            top: inner.options.$content.scrollTop() +
                                 inner.options.$parent.offset().top,
                            left: $(window).width() - inner.$panel.width() - 25,
                            opacity: 1
                        }, inner.options.animationDuration, function(){
                            $(this).data("animation-in-progress", null );
                        })
                        $(this).data("animation-in-progress", "showing" );
                   }
                   return false
                });
            }
        }
        
        this.init = (function($parent, options){
            if (inner.initialized)
                return
            inner.options = $.extend({}, inner.defaults, options)
            
            inner.init ()
            
            // bind n and b to special events
            $(document).keypress(function(e){
               var key = e.keyCode || e.which
               switch(key) {
                   case 110: // n
                     inner.nextHandler(e)
                   break;
                   case 98: // b
                     inner.prevHandler(e)
                   break;
                   default:
               }
            });            
            
            inner.initialized = true
            
            return this
        })($parent, options)
    }
    
    $.fn.diffTable = function(options){
        return this.each(function(){
           new diff($(this), options);
        });
    }
    
}(window, window.jQuery));

(function(window, $) {
   
    var spaces = function () {
        var inner = {
            self: this,
            initialized: false,
            /**
             * Mouse selection event
             * - upon a user's selection triggers a select event
             */
            mouse: {
                dragging: false,
                init: function () {
                    var that = this
                    $(document).mousedown(function (e) {
                       that.dragging = false
                    }).mousemove(function(e){
                        that.dragging = true
                    }).mouseup(function(e){
                        var wasDragging = that.dragging
                        that.dragging = false
                        if(wasDragging) {
                            $(document).trigger("select");
                        }
                    }).dblclick(function(e){
                        //$(document).trigger("select")
                    });
                },
            },           
            defaults: {
                "selector": "a.l, a.hl",
                "parent": "div#src pre",
                "selectedClass": "selected",
                "sourceContainer": "pre",
            },
            options: {},
            indent: function($el){
                return $el.each(function() {
                    if(! $(this).is("." + inner.options.selectedClass))
                        $(this).html($(this).html() + "&nbsp");
                    $(this).addClass(inner.options.selectedClass)
                });
            },
            /**
             * @returns {Boolean} if client is IE
             */
            ie: function() {
                var ua = window.navigator.userAgent;
                if (ua.indexOf('MSIE ') > 0 || 
                    ua.indexOf('Trident/') > 0 ||
                    ua.indexOf('Edge/') > 0 )
                    return true;
                return false;
            },            
            getSelection: function () {
                if (window.getSelection)
                    return window.getSelection()
                return null
            },
            /**

             * Select closest element giben by options.selector to the actual
             * element
             * 
             * @param {jQuery Object} $el actual element
             * @param {boolean} next direction
             * @param {boolean} last if it is the last element in array
             * @param {int} depth max distance from the path between the actual
             *                    element and the root element
             * @returns {Object} of {element found, used given direction}
             */
            around: function ($el, next, last, depth) {
              var slc = inner.options.selector
              depth = depth || 10
              next = next || false      
              last = last || false

                if($el.is(slc)) {
                  return { "element": $el, "directionUsed": false };
              }  

              var $tmp = $el;
              var $result = null
              var parentDepth = 10
              // scan every previous parent up to partentDepth
              // and scan every #depth nodes around a particular parent
              while ( $tmp.length && 
                      !$tmp.is (inner.options.sourceContainer) && 
                      parentDepth >= 0 ) {
                  if($tmp.is(slc))
                      return { "element": $tmp, "directionUsed": false }
                  if(!next) {
                      // scan #depth previous nodes if they are desired
                      for ( var i = 0, $tmp2 = $tmp; i < depth && $tmp2.length; i ++ ) {
                          if ($tmp2.is(slc))
                              return { "element": $tmp2, "directionUsed": true }
                          $tmp2 = $tmp2.prev()
                      }
                  } else {
                      // scan #depth next nodes if they are desired
                      for ( var i = 0, $tmp2 = $tmp; i < depth && $tmp2.length; i ++ ) {
                          if ($tmp2.is(slc))
                              return { "element": $tmp2, "directionUsed": true }
                          $tmp2 = $($tmp2.get(0).nextElementSibling)
                      }              
                  }
                  // going level up
                  $tmp = $tmp.parent()
                  parentDepth --;
              }
              // no luck in parents -> find links within this node
              var $down = $el.find(slc)
              if($down.length){
                  if(last) {
                     return { "element": $down.last(), "directionUsed": false }
                  } else {
                     return { "element": $down.first (), "directionUsed": false }
                  }
              }      
              return { "element": null, "directionUsed": false }
            },
            /**
             * Handle select event by extracting a range, element lookup,
             * extending range to approximate bounds and updating range back
             * to the client
             * 
             * @param {Event} e
             * @returns {undefined} nothing
             */
            selectHandler: function(e) {
                var selection = null
                if ( ( selection = inner.getSelection() ) == null ) {
                    console.debug ( "No selection returned. No browser support?")
                    return
                }
                var selector = inner.options.selector
                var parentSelectorWithLinks = inner.options.selector
                        .replace( /,/g, ", " + inner.options.parent + " ")
                        .replace( /^/, inner.options.parent + " ");
                
                if(selection.rangeCount <= 0){
                    //nothing to process
                    return
                }

                var range = selection.getRangeAt(0)

                for ( var i = 0; i < selection.rangeCount; i ++ ) {
                    // if there were more ranges, select the one which is inside 
                    // the parent element
                    // default: div#src pre
                    var r = selection.getRangeAt(i)
                    if($(r.commonAncestorContainer).has(inner.options.parent).length){
                        range = r;
                    }
                }
                // clone range (so it works in chrome)
                range = range.cloneRange()

                // finding closest starting node based on inner.options.selector
                // by default it's the closest line link
                $start = $(range.startContainer);
                $start = inner.around($start, next = false, last = false)
                $start = $start.element;
                if($start == null){
                    // not successful
                    // - no line link
                    // - range is larger than the whole source container
                    // find the first link in the source container
                    $start = $(parentSelectorWithLinks).filter(":first")
                }

                if(! $start.length) {
                    console.debug ( "Cannot determine start link");
                    return
                }

                $end = $(range.endContainer);
                if($end.is(inner.options.sourceContainer) && selection.toString().length <= 5) {
                    // probably on the same line
                    $end = $start.next().nextUntil(selector).next()
                    $end_indir = true
                } else {
                    // not on the same line so find closest node according to 
                    // selector in next nodes
                    $end = inner.around($end, next = true, last = true)
                    $end_indir = $end.directionUsed;
                    $end = $end.element;            
                }
                if($end == null){
                    // not successful
                    // - no line link
                    // - range is larger than the whole source container
                    // find the last link in the source container
                    $end = $(parentSelectorWithLinks).filter(":last")
                    $end_dir = false
                }
                
                if (!$end.length) {
                    console.debug("Cannot determine end link")
                    return
                }          
                
                range.setStartBefore($start.get(0))
                
                if ($end_indir){
                    range.setEndBefore($end.get(0))
                } else {
                    range.setEndAfter($end.get(0))
                }

                // extract contents (html now has dissapeared)
                var content = range.extractContents()

                try {
                    // select all links in the content
                    // indent link by one space
                    inner.indent($(content.querySelectorAll(selector)))

                } finally {
                    // even if there was an error fill the html back to the site
                    for( var i = 0; i < $(content).length; i ++ )
                        range.insertNode(content)  
                }

                // clears the selection
                selection.removeAllRanges()
                // inserts the new updated range
                selection.addRange(range)
            },
            init: function() {
                
                // IE does not need this feature
                if( inner.ie () )
                    return
                
                inner.mouse.init()
                $(document).bind("select", inner.selectHandler );
            }
        } // inner
        
        this.init = function (options) {
            if ( inner.initialized )
                return this;
            inner.options = $.extend(inner.defaults, options, {})
            inner.init()
            inner.initialized = true
            return this;
        }
    }
    $.spaces = new ($.extend(spaces, $.spaces ? $.spaces : {}));
}) (window, window.jQuery);

(function ($) {
    var accordion = function ($parent, options) {
        var inner = {
            initialized: false,
            options: {},
            defaults: {
                "showAllSelector": ".accordion_show_all",
                "hideAllSelector": ".accordion_hide_all"
            },
            $pannels: [],
            init: function () {
                inner.$pannels = inner.options.parent.find(".panel-body-accordion");

                inner.options.parent.find(".panel-heading-accordion").click(function (e) {
                    $(this).parent().find(".panel-body-accordion").each(function () {
                        if ($(this).data("accordion-visible") &&
                                $(this).data("accordion-visible") === true) {
                            $(this).hide().data("accordion-visible", false)
                        } else {
                            $(this).show().data("accordion-visible", true)
                        }
                    });
                    return false
                });

                inner.options.parent.find(inner.options.showAllSelector).click(function (e) {
                    inner.$pannels.data("accordion-visible", true).show()
                    inner.options.parent.find(inner.options.hideAllSelector).show()
                    inner.options.parent.find(inner.options.showAllSelector).hide()
                    return false;
                });

                inner.options.parent.find(inner.options.hideAllSelector).click(function (e) {
                    inner.$pannels.data("accordion-visible", false).hide();
                    inner.options.parent.find(inner.options.hideAllSelector).hide()
                    inner.options.parent.find(inner.options.showAllSelector).show()
                    return false;
                });

                inner.options.parent.find(inner.options.hideAllSelector).hide();

                inner.initialized = true;
            }
        }

        var init = (function ($parent, options) {
            if (inner.initialized)
                return
            inner.options = $.extend({}, {parent: $parent}, inner.defaults, options)
            inner.init();
        })($parent, options);
    };

    $.fn.accordion = function (options) {
        return this.each(function () {
            options = options || {}
            new accordion($(this), options);
        });
    };
})(jQuery);

(function(window, $) {
   
    var hash = function () {
        var inner = {
            self: this,
            initialized: false,
            highlighted: [],
            defaults: {
              highlightedClass: 'target',
              linkSelectorTemplate: '{parent} a[name={n}]',
              clickSelector: '{parent} a.l, {parent} a.hl',
              parent: 'div#src',
              autoScroll: true,
              autoScrollDuration: 500,
              tooltip: true
            },
            options: {},
            $tooltip: null,
            bindClickHandler: function() {
                $(inner.format(inner.options.clickSelector, {parent: inner.options.parent})).click (function (e){
                    if(e.shiftKey) {
                        // shift pressed
                        var val = inner.toInt($(this).attr("name"))
                        if(!val){
                            return false
                        }

                        var l = inner.getLinesParts(window.location.hash)

                        if(l.length == 2) {
                            window.location.hash = "#" + Math.min(l[0], val) + "-" + Math.max(val, l[1])
                        } else if ( l.length == 1){
                            window.location.hash = "#" + Math.min(l[0], val) + "-" + Math.max(l[0], val) 
                        }
                        return false
                    }
                    return true
                })                    
            },
            
            getHashParts: function (hash) {
                if(!hash || hash == "")
                    return hash;
                return (hash = hash.split("#")).length > 1 ? hash[1] : "";
            },

            getLinesParts: function ( hashPart ) {
              hashPart = inner.getHashParts(hashPart)
              if (!hashPart || hashPart == "")
                  return hashPart;
              var s = hashPart.split("-")
              if(s.length > 1 && inner.toInt(s[0]) && inner.toInt(s[1]))
                  return [ inner.toInt(s[0]), inner.toInt(s[1]) ]
              if(s.length > 0 && inner.toInt(s[0]))
                  return [ inner.toInt(s[0]) ]
              return []
            },

            lines: function (urlPart) {
                p = inner.getLinesParts(urlPart)
                if(p.length == 2) {
                    var l = [];
                    for ( var i = Math.min(p[0],p[1]); i <= Math.max(p[0], p[1]); i ++ )
                        l.push(i);
                    return l;
                } else if (p.length == 1){
                    return [ p[0] ]
                }
                return [];
            },
        

            reload: function(e){
                for ( var i = 0; i < inner.highlighted.length; i ++ ) {
                    // remove color
                    inner.highlighted[i].removeClass(inner.options.highlightedClass)
                }
                inner.highlighted = []

                var lines = inner.lines(window.location.hash);

                if(lines.length < 1) {
                    // not a case of line highlighting
                    return
                }

                for ( var i = 0; i < lines.length; i ++ ) {
                    // color
                    var slc = inner.format(inner.options.linkSelectorTemplate, { "parent": inner.options.parent,
                                                                                  "n": lines[i] } );
                    var el = $(slc).addClass(inner.options.highlightedClass)
                    inner.highlighted.push(el)
                }                   
            },
            format: function(format) {
                var args = Array.prototype.slice.call(arguments, 1);
                args = args.length > 0 ? typeof args[0] === "object" ? args[0] : args : args;
                return format.replace(/{([a-zA-Z0-9_-]+)}/g, function(match, number) {
                  return typeof args[number] != 'undefined'
                    ? args[number] 
                    : match
                  ;
                });
            },
            toInt: function (string) {
                return parseInt(string)
            },
            scroll: function (){
                if(!inner.options.autoScroll)
                    return
   
                var lines = inner.getLinesParts(window.location.hash);
                if(lines.length > 0) {
                   var line = lines[0] // first line
                   $("*").animate({
                      scrollTop: $(inner.format(inner.options.linkSelectorTemplate, {
                          parent: inner.options.parent,
                          n: line
                      })).offset().top - $(inner.options.parent).offset().top
                   }, inner.options.autoScrollDuration);
                }
            },
            tooltip: function() {
                if(!inner.options.tooltip)
                    return
                
                inner.$tooltip = inner.$tooltip ? 
                                    inner.$tooltip :
                                    $("<div>Did you know? You can select a range of lines<br /> by clicking on the other while holding shift key.</div>")
                                    .appendTo($("body"))
                                    .hide()
                                    .addClass("tooltip")
                                    .addClass("diff_navigation_style")
                
                
                $(inner.format(inner.options.clickSelector, {parent: inner.options.parent}))
                .click(function(e) {
                    if(!inner.options.tooltip)
                        return
                   // show box
                   var $el = $(this)
                   setTimeout(function () {
                    inner.$tooltip
                            .show()
                            .stop()
                            .fadeIn()
                            .fadeOut( 5000 )
                            .offset({ 
                                top: $el.offset().top + 20, 
                                left: $el.offset().left + $el.width() + 5 
                            });
                   }, 300);
                   inner.options.tooltip = false;
                })
            }
        } // inner
        
        this.init = function (options) {
            if ( inner.initialized ) {
                return this;
            }

            inner.options = $.extend(inner.defaults, options, {})
            
            $(window).bind("hashchange", inner.reload )
            
            inner.reload()
            
            inner.tooltip()
            
            inner.bindClickHandler()
            
            inner.scroll()

            inner.initialized = true
            
            return this;
        }
    }
    $.hash = new ($.extend(hash, $.hash ? $.hash : {}));
}) (window, window.jQuery);

$(document).ready(function () {
    $(".projects").accordion()

    $("#difftable").diffTable()

    // starting spaces plugin
    $.spaces.init()
    
    $.hash.init({ parent: "pre"})
    
    $(".projects_select_all").click(function (e) {
        var projects = $(this).closest(".panel").find("table tbody tr, .panel-heading table tbody tr")
        var multiselect = $("select#project")
        if (!multiselect.length) {
            console.debug("No multiselect element with id = 'project'")
            return false
        }

        multiselect.find("option").attr("selected", false)
        projects.each(function () {
            var key = $(this).find(".name")
            if (!key.length)
                return
            key = key.text().replace(/^\s+|\s+$/g, '') // trim
            multiselect.find("option[value=" + key + "]").attr("selected", true)
            multiselect.change();
        });
        return false;
    });
});

/*
 * Portions Copyright 2011 Jens Elkner.
 */
document.pageReady = [];
document.domReady = [];

window.onload = function() {
    for(var i in document.pageReady) {
        document.pageReady[i]();
    }
}

$(document).ready(function() {
    for(var i in this.domReady) {
        document.domReady[i]();
    }
});

/**
 * Resize the element with the ID 'content' so that it fills the whole browser
 * window (i.e. the space between the header and the bottom of the window) and
 * thus get rid off the scrollbar in the page header.
 */
function resizeContent() {
    if (document.adjustContent != 0) {
        $('#content').css('top', $('body').outerHeight(true)).css('bottom', 0);
    }
}

function domReadyMast() {
    var h = document.hash;
    if (!window.location.hash) {
        if (h != null && h != "null" && h != "")  {
            window.location.hash=h
        } else {
            $('#content').focus();
        }
    }
    if (document.annotate) {
        $('a.r').tooltip({ left: 5, showURL: false });
        var toggle_js = document.getElementById('toggle-annotate-by-javascript');
        var toggle_ss = document.getElementById('toggle-annotate');

        toggle_js.style.display = 'inline';
        toggle_ss.style.display = 'none';
    }
}

function pageReadyMast() {
    document.adjustContent = 0;
    if ($('#whole_header') != null && $('#content') != null) {
        document.adjustContent = 1;
        resizeContent();
    }
    $(window).resize(
        function() {
            resizeContent();
        }
    );
}

function domReadyMenu() {
    var projects = document.projects;
    var sbox = document.getElementById('sbox');
/*
    $("#project").autocomplete(projects, {
        minChars: 0,
        multiple: true,
        multipleSeparator: ",",
        //mustMatch: true,
        matchContains: "word",
        max: 200,
        cacheLength:20,
        //autoFill: false,
        formatItem: function(row, i, max) {
                return (row != null) ? i + "/" + max + ": " + row[0] : "";
            },
        formatMatch: function(row, i, max) {
                return (row != null) ? row[0] : "";
            },
        formatResult: function(row) {
                return (row != null) ? row[0] : "";
            },
        width: "300px"
    });
*/
    // TODO  Bug 11749
    // var p = document.getElementById('project');
    // p.setAttribute("autocomplete", "off");
}

function domReadyHistory() {
    // start state should ALWAYS be: first row: r1 hidden, r2 checked ;
    // second row: r1 clicked, (r2 hidden)(optionally)
    // I cannot say what will happen if they are not like that, togglediffs
    // will go mad !
    $("#revisions input[type=radio]").bind("click",togglediffs);
    togglediffs();
}

function get_annotations() {
    link = document.link +  "?a=true";
    if (document.rev.length > 0) {
        link += '&' + document.rev;
    }
    hash = "&h=" + window.location.hash.substring(1, window.location.hash.length);
    window.location = link + hash;
}

function toggle_annotations() {
    $("span").each(
        function() {
            if (this.className == 'blame') {
                this.className = 'blame-hidden';
            } else if (this.className == 'blame-hidden') {
                this.className = 'blame';
            }
        }
    );
}

/** list.jsp */

/**
 * Initialize defaults for list.jsp
 */
function pageReadyList() {
    document.sym_div_width = 240;
    document.sym_div_height_max = 480;
    document.sym_div_top = 100;
    document.sym_div_left_margin = 40;
    document.sym_div_height_margin = 40;
    document.highlight_count = 0;
    $(window).resize(function() {
        if (document.sym_div_shown == 1) {
            document.sym_div.style.left = get_sym_div_left() + "px";
            document.sym_div.style.height = get_sym_div_height() + "px";
        }
    });
}

/* ------ Navigation window for definitions ------ */
/**
 * Create the Navigation toggle link as well as its contents.
 */
function get_sym_list_contents() {
    // var contents = "<input id=\"input_highlight\" name=\"input_highlight\"
    // class=\"q\"/>";
    // contents += "&nbsp;&nbsp;";
    // contents += "<b><a href=\"#\" onclick=\"javascript:add_highlight();return
    // false;\" title=\"Add highlight\">Highlight</a></b><br/>";
    var contents =
        "<a href=\"#\" onclick=\"javascript:lsttoggle();\">[Close]</a><br/>"
    if (typeof get_sym_list != 'function') {
        return contents;
    }

    var symbol_classes = get_sym_list();
    for ( var i = 0; i < symbol_classes.length; i++) {
        if (i > 0) {
            contents += "<br/>";
        }
        var symbol_class = symbol_classes[i];
        var class_name = symbol_class[1];
        var symbols = symbol_class[2];
        contents += "<b>" + symbol_class[0] + "</b><br/>";

        for (var j = 0; j < symbols.length; j++) {
            var symbol = symbols[j][0];
            var line = symbols[j][1];
            contents += "<a href=\"#" + line + "\" class=\"" + class_name + "\" onclick=\"lnshow(); return true;\">"
                + escape_html(symbol) + "</a><br/>";
        }
    }

    return contents;
}

function escape_html(string) {
    return string.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
}

function get_sym_div_left() {
    document.sym_div_left = $(window)
        .width() - (document.sym_div_width + document.sym_div_left_margin);
    return document.sym_div_left;
}

function get_sym_div_height() {
    document.sym_div_height = $(window)
        .height() - document.sym_div_top - document.sym_div_height_margin;

    if (document.sym_div_height > document.sym_div_height_max) {
        document.sym_div_height = document.sym_div_height_max;
    }
    return document.sym_div_height;
}

function get_sym_div_top() {
    return document.sym_div_top;
}

function get_sym_div_width() {
    return document.sym_div_width;
}

/**
 * Toggle the display of the 'Navigation' window used to highlight definitions.
 */
function lsttoggle() {
    if (document.sym_div == null) {
        document.sym_div = document.createElement("div");
        document.sym_div.id = "sym_div";

        document.sym_div.className = "sym_list_style";
        document.sym_div.style.margin = "0px auto";
        document.sym_div.style.width = get_sym_div_width() + "px";
        document.sym_div.style.height = get_sym_div_height() + "px";
        document.sym_div.style.top = get_sym_div_top() + "px";
        document.sym_div.style.left = get_sym_div_left() + "px";

        document.sym_div.innerHTML = get_sym_list_contents();

        document.body.appendChild(document.sym_div);
        document.sym_div_shown = 1;
    } else if (document.sym_div_shown == 1) {
        document.sym_div.className = "sym_list_style_hide";
        document.sym_div_shown = 0;
    } else {
        document.sym_div.style.height = get_sym_div_height() + "px";
        document.sym_div.style.width = get_sym_div_width() + "px";
        document.sym_div.style.top = get_sym_div_top() + "px";
        document.sym_div.style.left = get_sym_div_left() + "px";
        document.sym_div.className = "sym_list_style";
        document.sym_div_shown = 1;
    }
}

/**
 * Toggle the display of line numbers.
 */
function lntoggle() {
    if (typeof document.line_numbers_shown === 'undefined' || document.line_numbers_shown === 1) {
        lnhide();
    } else {
        lnshow();
    }
}

function lnhide() {
    $("a.hl").each(
        function() {
            $(this).removeClass('hl').addClass('hl-hide');
            this.setAttribute("tmp", this.innerHTML);
            this.innerHTML = '';
        }
    );
    $("a.l").each(
        function() {
            $(this).removeClass('l').addClass('l-hide');
            this.setAttribute("tmp", this.innerHTML);
            this.innerHTML = '';
        }
    );
    document.line_numbers_shown = 0;
}

function lnshow() {
    $("a.l-hide").each(
        function () {
            $(this).removeClass('l-hide').addClass('l');
            this.innerHTML = this.getAttribute("tmp");
        }
    );
    $("a.hl-hide").each(
        function () {
            $(this).removeClass('hl-hide').addClass('hl');
            this.innerHTML = this.getAttribute("tmp");
        }
    );
    document.line_numbers_shown = 1;
}

/* ------ Highlighting ------ */
/**
 * An expensive Highlighter:
 * Note: It will replace link's href contents as well, be careful.
 */
/* Not used.
function HighlightKeywordsFullText(keywords) {
    var el = $("body");
    $(keywords).each(
        function() {
            var pattern = new RegExp("("+this+")", ["gi"]);
            var rs = "<span style='background-color:#FFFF00;font-weight:bold;'"
                + ">$1</span>";
            el.html(el.html().replace(pattern, rs));
        }
    );
    // HighlightKeywordsFullText(["nfstcpsock"]);
}
*/

/**
 *  Highlight keywords by changeing the style of matching tags.
 */
function HighlightKeyword(keyword) {
    var high_colors = [ "#ffff66", "#ffcccc", "#ccccff", "#99ff99", "#cc66ff" ];
    var pattern = "a:contains('" + keyword + "')";
    $(pattern).css({
        'text-decoration' : 'underline',
        'background-color' : high_colors[document.highlight_count
            % high_colors.length],
        'font-weight' : 'bold'
    });
    document.highlight_count++;
}
//Test: HighlightKeyword('timeval');

/**
 * Highlight the text given as value of the element with the ID "input_highlight" .
 * @see HighlightKeyword
 */
function add_highlight() {
    var tbox = document.getElementById('input_highlight');
    HighlightKeyword(tbox.value);
}

function toggle_filelist() {
    $("div").each(
        function() {
            if (this.className == "filelist") {
                this.setAttribute("style", "display: none;");
                this.className = "filelist-hidden";
            } else if (this.className == "filelist-hidden") {
                this.setAttribute("style", "display: inline;");
                this.className = "filelist";
            }
        }
    );
}

function toggle_revtags() {
    $("tr").each(
        function() {
            if (this.className == "revtags") {
                this.setAttribute("style", "display: none;");
                this.className = "revtags-hidden";
            } else if (this.className == "revtags-hidden") {
                this.setAttribute("style", "display: table-row;");
                this.className = "revtags";
            }
        }
    );
    $("span").each(
        function() {
            if (this.className == "revtags") {
                this.setAttribute("style", "display: none;");
                this.className = "revtags-hidden";
            } else if (this.className == "revtags-hidden") {
                this.setAttribute("style", "display: inline;");
                this.className = "revtags";
            }
        }
    );
}

function togglediffs() {
    var cr2 = false;
    var cr1 = false;
    $("#revisions input[type=radio]").each(
        function() {
            if (this.name=="r1") {
                if (this.checked) {
                    cr1 = true;
                    return true;
                }
                if (cr2) {
                    this.disabled = ''
                } else {
                    this.disabled = 'true'
                }
            } else if (this.name=="r2") {
                if (this.checked) {
                    cr2=true;
                    return true;
                }
                if (!cr1) {
                    this.disabled = ''
                } else {
                    this.disabled = 'true'
                }
            }
        }
    );
}

function selectAllProjects() {
    $("#project *").attr("selected", "selected");
}

function invertAllProjects() {
    $("#project *").each(
        function() {
            if ($(this).attr("selected")) {
                $(this).removeAttr("selected");
            } else {
                $(this).attr("selected", "true");
            }
        }
    );
}

function goFirstProject(e) {
    e = e || window.event
    
    if($(e.target).is("option")) {
        var selected=$.map($('#project :selected'), function(e) {
                return $(e).text();
            });
        window.location = document.xrefPath + '/' + selected[0];
    } else if ( $(e.target).is("optgroup") ) {
        if(! e.shiftKey) {
            $("#project :selected").attr("selected", false).change();
        }
        $(e.target).children().attr("selected", true).change();
    }
}

function clearSearchFrom() {
    $("#sbox :input[type=text]").each(
        function() {
                $(this).attr("value", "");
        }
    );
    $("#type :selected").removeAttr("selected");
}

function checkEnter(event) {
    concat='';
    $("#sbox :input[type=text]").each(
        function() {
                concat+=$.trim($(this).val());
        }
    );
    if (event.keyCode == '13' && concat=='')
    {
        goFirstProject(event);
    } else if (event.keyCode == '13') {
        $("#sbox").submit();
    }
}

// Intelligence Window code starts from here
document.onmousemove = function(event) {
    event = event || window.event; // cover IE
    document.intelliWindowMouseX = event.clientX;
    document.intelliWindowMouseY = event.clientY;
};

$(document).keypress(function(e) {
    if (document.activeElement.id === 'search' ||
        typeof document.intelliWindow === 'undefined') {
        return true;
    }

    if (e.which === 49) { // '1' pressed
        if (document.intelliWindow.className === "intelli_window_style") {
            hideIntelliWindow();
        } else if (document.intelliWindow.className === "intelli_window_style_hide") {
            showIntelliWindow();
        }
    }
    if (e.which === 50) { // '2' pressed
        var symbol = document.intelliWindow.symbol;
        var highlighted_symbols_with_same_name = $("a").filter(function(index) {
            var bgcolor = $(this).css("background-color");
            return $(this).text() === symbol &&
                (bgcolor === "rgb(255, 215, 0)" || bgcolor === "rgb(255,215,0)" || bgcolor === "#ffd700"); // gold.  the last two cover IE
        })
        if (highlighted_symbols_with_same_name.length === 0) {
            highlightSymbol(symbol);
        } else {
            unhighlightSymbol(symbol);
        }
    }
    return true;
});

function onMouseOverSymbol(symbol, symbolType) {
    updateIntelliWindow(symbol, symbolType);
}

function updateIntelliWindow(symbol, symbolType) {
    if (!document.intelliWindow) {
        createIntelliWindow();
    }
    var header = [
        createCapitionHTML(),
        createSymbolHTML(symbol),
        createDescriptionHTML(symbolType),
    ].join("");

    document.intelliWindow.innerHTML = header + createActionHTML(symbol, symbolType);
    document.intelliWindow.symbol = symbol;
}

function showIntelliWindow() {
    var iw = document.intelliWindow;
    iw.className = "intelli_window_style";

    var top;
    var left;
    if (document.intelliWindowMouseY + iw.offsetHeight + 20 > $(window).height()) {
        top = $(window).height() - iw.offsetHeight - 20;
    } else {
        top = document.intelliWindowMouseY;
    }
    if (document.intelliWindowMouseX + iw.offsetWidth + 20 > $(window).width()) {
        left = $(window).width() - iw.offsetWidth - 20;
    } else {
        left = document.intelliWindowMouseX;
    }
    iw.style.top = top + "px";
    iw.style.left = left + "px";
}

function createIntelliWindow() {
    document.intelliWindow = document.createElement("div");
    document.intelliWindow.id = "intelli_win";
    document.body.appendChild(document.intelliWindow);
    hideIntelliWindow();
}

function hideIntelliWindow() {
    document.intelliWindow.className = "intelli_window_style_hide";
}

function createCapitionHTML() {
    return '<a onclick="hideIntelliWindow()">[Close]</a><br/><b>Intelligence Window</b><br/>';
}

function createSymbolHTML(symbol) {
    return "<i><h2>" + symbol + "</h2></i>";
}

function createDescriptionHTML(symbolType) {
    switch (symbolType) {
        case "def":
            return "A declaration or definition.<hr/>";
        case "defined-in-file":
            return "A symbol declared or defined in this file.<hr/>";
        case "undefined-in-file":
            return "A symbol declared or defined elsewhere.<hr/>";
        default:
            // should not happen
            return "Something I have no idea about.<hr/>";
    }
}

function createActionHTML(symbol, symbolType) {
    var escapedSymbol = escapeSingleQuote(symbol);
    var project = $("input[name='project']").val();
    return [
        "In current file:<br/><ul>",
        "<li><a onclick=\"highlightSymbol('", escapedSymbol, "')\">Highlight <b><i>", symbol,
            "</i></b></a>.</li>",
        "<li><a onclick=\"unhighlightSymbol('", escapedSymbol, "')\">Unhighlight <b><i>", symbol,
            "</i></b></a>.</li>",
        "<li><a onclick=\"unhighlightAll()\">Unhighlight all.</li></ul>",
        "In project ", project, ":<br/><ul>",
        "<li><a onclick=\"intelliWindowSearch('defs=', '", escapedSymbol, "', '", symbolType,
            "')\">Search for definitions of <i><b>", symbol,
            "</b></i>.</a></li>",
        "<li><a onclick=\"intelliWindowSearch('refs=', '", escapedSymbol, "', '", symbolType,
            "')\">Search for references of <i><b>", symbol,
            "</b></i>.</a></li>",
        "<li><a onclick=\"intelliWindowSearch('q=', '", escapedSymbol, "', '", symbolType,
            "')\">Do a full search with <i><b>", symbol,
            "</b></i>.</a></li>",
        "<li><a onclick=\"intelliWindowSearch('path=', '", escapedSymbol, "', '", symbolType,
            "')\">Search for file names that contain <i><b>", symbol,
            "</b></i>.</a></li></ul>",
        "<a onclick=\"googleSymbol('", escapedSymbol, "')\">Google <b><i>", symbol, "</i></b>.</a>"
    ].join("");
}

function highlightSymbol(symbol) {
    var symbols_with_same_name = $("a").filter(function(index) {
        return $(this).text() === symbol;
    })
    symbols_with_same_name.css("background-color",  "rgb(255, 215, 0)"); // gold
    return false;
}

function unhighlightSymbol(symbol) {
    var symbols_with_same_name = $("a").filter(function(index) {
        return $(this).text() === symbol;
    })
    symbols_with_same_name.css("background-color", "rgb(255, 255, 255)"); // white
    return false;
}

function unhighlightAll() {
    $("a").filter(function(index) {
        var bgcolor = $(this).css("background-color");
        return bgcolor === "rgb(255, 215, 0)" || bgcolor === "rgb(255,215,0)" || bgcolor === "#ffd700";  // gold.  the last two cover IE
    }).css("background-color", "rgb(255, 255, 255)"); // white
    return false;
}

function intelliWindowSearch(param, symbol, symbolType) {
    var contextPath = $("#contextpath").val();
    var project = $("input[name='project']").val();
    var url = contextPath + "/s?" + param + symbol + "&project=" + project;
    window.open(url, '_blank');
    return false;
}

function googleSymbol(symbol) {
    var url = "https://www.google.com/search?q=" + symbol;
    window.open(url, '_blank');
    return false;
}

function escapeSingleQuote(string) {
    return string.replace("'", "\\'");
}
