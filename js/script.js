// Author: Clayton Rieck

$(function() {

	// for markdown code highlighting
	hljs.initHighlightingOnLoad();

	// 'marked' is the markdown parser I used
	marked.setOptions({
		highlight: function (code){
			return hljs.highlightAuto(code).value;
		}
	});

	// create jQuery function to center a
	// DOM element (the detail view)
	jQuery.fn.center = function () {
	    
	    this.css("top", Math.max(0, ((($(window).height()) - $(this).outerHeight()) / 6) + 
	                                                $(window).scrollTop()) - 200 + "px");
	    this.css("left", Math.max(0, (($(window).width() - $(this).outerWidth()) / 22) + 
	                                                $(window).scrollLeft()) + "px");
	    return this;
	}

	// if an issue has no labels this function
	// sets the labels div to hidden so the issues
	// don't show negative space
	function cleanLabels() {
		var labelDiv = $('.labels');
		var allLabelDivs = $(document).find(labelDiv);

		allLabelDivs.each(function(item){
			if ($(allLabelDivs[item]).children().children().length === 0){
				$(allLabelDivs[item]).hide();
			}
		});
	}

	$('#back').hide(); // hide back button on intial load

	// when clicked outside of the detail view
	// the detail view will close
	$(document).mouseup(function(e){
		var issueDetail = $('.details-wrapper');

		if(!issueDetail.is(e.target) && issueDetail.has(e.target).length === 0) {
			issueDetail.remove();
			$('.container').animate({
				opacity: 1
			}, 500);
			$('.header').animate({
				opacity: 1
			}, 500);
			$('body').css('overflow', 'scroll');
		}
	});

	// Router used for page navigation between sets
	// of 25 issues.
	// ROUTE: #page/(an int incremented/decremented by 1)
	var IssueRouter = Backbone.Router.extend({
		routes: {
			'page/:id':'getPage'
		}
	});

	// model that holds an individual issue
	// INFO: Issue Number, Title, Labels, 
	// 		 Username and gravatar, body preview (up to 140 characters)
	var IssueModel = Backbone.Model.extend({
		initialize: function() {
			var preview = this.generateIssuePreview(this.get("body"));
			this.set({body_preview: preview});
		},

		generateIssuePreview: function(bodyText) {
			var that = this;
			var issue_body = bodyText;
			var bodyPreview = '';

			if (issue_body.length > 140) {

				if (issue_body.charAt(141) != ' ' || issue_body.charAt(141) != '\n') {
					issue_body = issue_body.slice(0,140);
					
					var character;
					for (var i = issue_body.length-1; i >=0; i--) {
						character = issue_body.charAt(i);
						if (character === ' ' || character === '\n') {
							that.bodyPreview = issue_body.slice(0,i) + " ...";
							break;
						};
					}
				}; 
			} else {
				that.bodyPreview = issue_body.slice(0,140);
			};

			return that.bodyPreview;
		}

	});

	// model that holds information for the detail view
	// of an issue
	// INFO: Title, Summary, State, Labels, Reporting Username
	// 		 and gravatar, and all comments
	var IssueDetailModel = Backbone.Model.extend({
		initialize: function() {
			var textWithMentions = this.findMentions(this.get("body"));
			this.set({body:textWithMentions});
		},

		// finds github handles and links them to their
		// respective accounts.
		// ALGORITHM: Iterate over body and when a '@' is
		// encountered set up a var to hold the soon-to-be
		// handle. Continue to iterate while appending characters
		// to the end of the 'handle' variable. Once at the end
		// of the handle (as checked by the regex, /^[a-z0-9]+$/i)
		// push handle onto an array of all handles in the list
		// Iterate over handles list and surround them with a-tags
		// with an href to https://github.com/(handle - '@')
		findMentions: function(bodyText) {
			var handleArray = [];
			var that = this;
			for (var i = 0; i < bodyText.length; i++) {

				var handle = "";
				if (bodyText[i] === '@') {
					handle = handle + bodyText[i];

					for (var a = i+1; a < bodyText.length; a++) {
						if (!bodyText[a].match(/^[a-z0-9]+$/i)) { // denotes end of handle name
																  // checks if character is alphanumeric
							handleArray.push(handle);

						} else {
							handle = handle + bodyText[a];
						};
					};

				};
			};

			for (var i = 0; i < handleArray.length; i++) {

				// replace github handles with links to their pages
				bodyText = bodyText.replace(handleArray[i], "<a href='https://github.com/"+handleArray[i].slice(1)+"' target='_blank'>"+handleArray[i]+"</a>")
			};

			return bodyText;
		}
	});


	// collection that holds all of the individual issues (models)
	// url = repo to collect issues from
	var IssueCollection = Backbone.Collection.extend({
		model: IssueModel,
		url: 'https://api.github.com/repos/rails/rails/issues'
	});

	var issueColl;

	// view for the detail view of each issue.
	// Contains the IssueDetailModel as source of info
	var IssueDetailView = Backbone.View.extend({
		initialize: function() {	

		},

		render: function() {
			$(this.el).addClass('details-wrapper');

			var labels = this.model.get("labels");

			var stateStyle = "";

			// set background colors for open or closed state
			if (this.model.get("state") === 'open') {
				stateStyle = "background-color:#2ecc71";
			} else if (this.model.get("state") === 'closed') {
				stateStyle = "background-color:#e74c3c";
			}

			variables = {
				"profile_url": this.model.get("username"),
				"avatar": this.model.get("gravatar"),
				"username": this.model.get("username"),
				"issue_title": this.model.get("title"),
				"issue_labels": labels,
				"state": this.model.get("state"),
				"styling": stateStyle,
				"issue_body": marked( this.model.get("body") )
			};

			var template = _.template($("#detail_template").html(), variables);
			$(this.el).html(template); // compile html and store in 'el'
			
			this.parseComments(this.model.get("comments_url"));

			return this;
		},

		// Responsible for collecting the comments of a given
		// issue. If comments are returned from the ajax call
		// display those on the detail view with their respective
		// creators.
		// DESIGN CONSIDERATION: *** Should put each comment in a
		// 		   				 model and all of the models in a
		//						 collection instead of using
		// 						 an ajax call in the view ***
		parseComments: function(comment_url) {
			var that = this;
			var commentsString = "";

			$.ajax({
				url: comment_url,
				success: function(data) {

					$.each(data, function(comment){
						var user = data[comment]["user"]["login"];
						var user_pic = data[comment]["user"]["avatar_url"];
						var body = that.model.findMentions( data[comment]["body"] );

						var variables = {
							"profile_url": user,
							"avatar": user_pic,
							"username": user,
							"issue_body": marked( body )
						}

						var template = _.template($("#comments_template").html(), variables);
						$('.detail-container').append( "<div class='detail_comment'>"+ template +"</div>");	

					});
				}
			});

		},

	});

	// Individual issues seen on the default pages
	// of the app. 
	// INFO: Holds the IssueModel
	var IssueView = Backbone.View.extend({


		initialize: function() {
		},

		render: function() {
			var that = this;

			var user = this.model.get("user");
			var username = user["login"];
			var gravatar = user["avatar_url"];
			var issue_body = this.model.get("body_preview");
			var labels = this.model.get("labels");

			var labelHTML = this.parseLabels(labels);
			var bodyPreview ='';

			var variables = {
				"username": username,
				"avatar": gravatar,
				"profile_url": this.model.get("user")["login"],
				"issue_title": this.model.get("title"),
				"issue_number": this.model.get("number"),
				"issue_body": issue_body,
				"issue_labels": labelHTML

			};

			var template = _.template($("#issue_template").html(), variables);
			$(this.el).html(template); // compile html and store in 'el'

			return this; // return 'this' for chaining
		},

		// takes a list of labels and sets the color based on the
		// json object
		parseLabels: function(label_list){
			labelHTML = "";
			if (label_list.length > 0) {
				$.each(label_list, function(label){
					var labelInfo = label_list[label];
					var label_name = labelInfo["name"];
					var label_color = labelInfo["color"];

					var text_color = '#fff';

					if (label_color === 'ededed' || label_color === 'FFF700') {
						text_color = '#000';
					};

					// styles li for each label
					labelHTML = labelHTML + "<li class='label' style='background-color:#"+ label_color + ";color:"+text_color+"'>"+label_name+"</li>";
				});
				
			};

			return labelHTML;
		},

		events: {
			'click': 'newPage'
		},

		// called when a view is clicked
		// gets the necessary info from the model
		// and renders a detail view that has a detailModel
		// associated with it.
		// Also does other animatons/sets styling
		newPage: function() {
			$('.container').animate({
				opacity: 0.25
			});

			$('.header').animate({
				opacity: 0.25
			});

			var that = this;
			var detailModel = new IssueDetailModel({
				title : that.model.get("title"),
				body : that.model.get("body"),
				state : that.model.get("state"),
				labels: this.parseLabels( that.model.get("labels") ),
				username : that.model.get("user")["login"],
				gravatar : that.model.get("user")["avatar_url"],
				comments_url : that.model.get("comments_url")
			});

			var detailView = new IssueDetailView({
				model: detailModel
			});

			if ($('.details-wrapper').length != 0) {
				$('.details-wrapper').remove();
			}

			$('.container-wrapper').append(detailView.render().el);
			$('.details-wrapper').center();
			$('.details-wrapper').animate({
				opacity: 1
			}, 500);

			$('body').css('overflow', 'hidden');

		}
	});

	// Collection view for the app.
	// Holds all of the IssueViews that are displayed on the
	// default pages
	var IssuesCollectionView = Backbone.View.extend({
		initialize: function() {
			var that = this;
			this._issueViews = [];

			// add new issue view to the collection view.
			// new issues defined by model collection
			this.collection.each(function(issue){
				that._issueViews.push(new IssueView({
					model : issue,
					tagName : 'li' // default tag name for element of this view
				}));
				
			});
		},

		render: function() {
			var that = this;
			$(this.el).empty(); // empty the ul
			_(this._issueViews).each(function(issView){
				$(that.el).append(issView.render().el);
			});
			
		}
	});

	// gets issues from url and stores each one into
	// their own model. From there, each model gets
	// stored into a collection
	var collectionsArray = [];
	var collOfAllIssues = new IssueCollection();
	var appRouter = new IssueRouter();
	var issueCollectionView;
	var pageNumber = 1;

	collOfAllIssues.fetch({
		success: function(collOfAllIssues, res) {

			var pages = Math.ceil((collOfAllIssues.length)/25);
			var arrayLength = collOfAllIssues.length;
			var totalIssuesPerPage;

			// this is responsible for displaying the
			// first 25 items, then the next and so on.
			// It creates a new collection view for each
			// set of 25 or less issues that come from the
			// call to the github api and stores that in collectionsArray. 
			for (var i = 0; i < pages; i++) {
				var issueSubCollection = new IssueCollection();
				

				if (arrayLength > 25) {
					totalIssuesPerPage = 25;
				} else {
					totalIssuesPerPage = arrayLength;
				};
				
				for (var a = 0; a < totalIssuesPerPage; a++) {
					issueSubCollection.add(collOfAllIssues.at(a+(25*i)));
				};

				collectionsArray.push(issueSubCollection);

				arrayLength = arrayLength - 25;
			};

			// Depending on what page number you're on, the
			// collection view at the (page number) - 1 will be
			// rendered.
			// NOTE: This is called on page load/after the initial
			// 		 collection of issues
			issueCollectionView = new IssuesCollectionView({
				collection: collectionsArray[pageNumber-1],
				el: $('ul.issues')[0]
			});

			issueCollectionView.render();

			cleanLabels();

		}
	});

	// starts routing
	Backbone.history.start();

	// controls navigation from page to page
	$('#next').click(function(){
		pageNumber = pageNumber + 1;
		appRouter.navigate('page/'+pageNumber.toString(), {trigger: true});
	});

	$('#back').click(function(){
		pageNumber = pageNumber - 1;
		appRouter.navigate('page/'+pageNumber.toString(), {trigger: true});
	});

	// have router listen on url
	// this is responsible for calling render() on
	// whichever collection view needs to be rendered
	// (page numbers determined by :id in URL)
	appRouter.on('route:getPage', function(id){
		if (pageNumber >= collectionsArray.length) {
			pageNumber = collectionsArray.length - 1;
			$('#next').css('display', 'none');
		} else {
			$('#next').show();
		};
		
		if (pageNumber <= 0) {
			pageNumber = 0;
			$('#back').css('display', 'none');
		} else {
			$('#back').show();
		};

		issueCollectionView = new IssuesCollectionView({
			collection: collectionsArray[pageNumber],
			el: $('ul.issues')[0]
		});

		issueCollectionView.render();

		cleanLabels();

		$('html, body').animate({ scrollTop: 0 }, 'slow');

	});
});