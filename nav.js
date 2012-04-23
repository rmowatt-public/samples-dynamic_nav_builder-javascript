var efsNav = {

	shadowbox : null,

	doAjax : function(target, params, callback, method){
		if(!method)method = null;
		EFS.doAjax(target, params, callback, method)
	},


	/**
	* This takes node and callback as parameters
	* basically queries php for the node info and then applies callback to Ajax response
	*
	* @param int efsNavItemId
	* @param function callback
	* @return void
	* @author Richard B. Mowatt <rmowatt@efashionsolutions.com>
	**/

	getPhpNodeInfo : function(efsNavItemId, callback) {
		//request info and apply callback
		this.doAjax('/ajax/nav/'+efsNavItemId, 'navId='+efsNavItemId, callback);
	},

	/**
	* Passes groupName and Id to form from inital list of groupnames
	* At that point user will add details and submit to create efsNav object
	* which will be draggable
	*
	* @param int id
	* @param string groupName
	* @return void
	* @author Richard B. Mowatt <rmowatt@efashionsolutions.com>
	**/

	passGroupNameToForm : function(selectGroupName) {
		if($('navId').innerHTML == '0'){//there is no nav selected
			alert('Before using the tool, you must first chose an available nav, or create a new nav.'
			+' \n Please use the dropdown or NEW nav link at the top of this tool.');
			return false;
		}

		//otherwise fill in the form's groupName hidden field
		var selectedGroup = selectGroupName.options[selectGroupName.selectedIndex];
		$('groupName').value = selectedGroup.text;
	},

	/**
	* This creates a draggable representing a real efsNav item sitting in session
	* Sits in edit container
	* This will eventually be dragged to the efsNav layout container
	*
	* @param JSON transport
	* @return void
	* @author Richard B. Mowatt <rmowatt@efashionsolutions.com>
	**/

	createNewNode : function(transport) {
		//		$('navOverlay').style.display = 'none';
		loadingBox('close');
		var json = transport.responseText.evalJSON();
		var nodeId = json.nodeId;
		json = json.node;
		//if there is no groupname then this is a category, mark it as such
		var groupName = (json._groupName)?json._groupName : 'category';
		//create the new node w/ ajax vars
		var newNode = '<div id="'+nodeId+'" class="draggable">'+json._label.unescapeHTML() + ' - ('+groupName+')  </div>';
		//insert on page
		$('newNodesLi').insert({bottom : newNode});
		//make it a draggable!
		new Draggable(nodeId, { revert: true,
		scroll: window,
		onStart : efsNav.OTFEdit.removeOTFEdit}
		);

		//add an event listener to create an OTF edit box on double click
		Event.observe(nodeId, 'dblclick', function(event) {
			if(event.element().id == nodeId){//event bubbles up so we wanna make sure were tweaking the right node
				if(!efsNav.keyListener.getIsDown()){//only create OTF is in drop mode
					efsNav.OTFEdit.openOTFEdit(event.element().id)
				}
			}
		});

		var k = $(nodeId);
		if(json._level == 1){//this should be at root
			var drop = $('ROOT');
		}
		else{
			var drop = ($(json._parent));
		}
		//pass it on
		efsNav.updateNodeClass(k , drop);
	},

	/**
	*after node is confirmed created in session
	*this method is called to clear form, eval JSON and then getPhpNodeInfo attaching acallback to print info
	*
	* @param JSON transport
	* @return void
	* @author Richard B. Mowatt <rmowatt@efashionsolutions.com>
	**/

	submitNewNode : function(transport) {

		var formsToClear = $A(['editForm' , 'catForm']);

		formsToClear.each(function(formId){         //node was created clear all forms
			Form.reset(formId);return false;
			el = $A($(formId).getElements());
			//alert('dddd'); return false;
			el.each(function(e){
				alert(e.name)
			//	if (!e.name) {return false;}
				//if ($(e.id).value != 'Create') {
				//	$(e.id).value = '';
				//}
			}
			)
		})

		$('nodeId').value = 0;
		$('checkbox_sale').checked = false;
		$('checkbox_all').checked = false;

		var json = transport.responseText.evalJSON();
		var nodeId = json.nodeId;
		json = json.node;
		efsNav.getPhpNodeInfo(nodeId, efsNav.createNewNode);//create the new node, callback will place it on page
	},

	/**
	This creates the node that represents an actual link stored in php session
	*
	* @param Draggable drag
	* @param Droppable drop
	* @param string hclass
	* @return void
	* @author Richard B. Mowatt <rmowatt@efashionsolutions.com>
	**/

	createXMLNode : function(drag , drop, hclass) {
		if(!hclass) {//add to root
			drag.addClassName('h1');
		}
		else{//ipdate the className
			drag.className = '';
			drag.addClassName('draggable '+hclass);
		}
		if(drop.id=='dropBox') {//it was droppen on root icon so out it on root
			var myParent = 'ROOT';
		}
		else{
			var myParent = drop.id;
		}

		$(myParent).insert({bottom : drag})

		Droppables.add(drag.id,{
			overlap: 'vertical',
			accept: 'draggable',
			hoverclass: 'mouseoverdiv',
			onDrop: function(draggable, droppable, event) {
				efsNav.updateNodeClass(draggable, droppable);
			}
		});


		// here we have to make this recursive so that all children are updated
		efsNav.recurse(drag , function(el) {
			if(el.className != "omd"){
				efsNav.updateNodeClass(el, drag);
			}
		});

		var lis = $('newNodesLi').childElements();
		lis.each(function(el){
			if(el.innerHTML == ''){
				el.remove();
			}
		}
		)
	},

	/**
	* parses className for level
	*
	* @param EXTENDED_ELEMENT div
	* @return float
	* @author Richard B. Mowatt <rmowatt@efashionsolutions.com>
	**/

	parseForLevel : function(div) {
		var str = $(div).classNames().toString();//return classnames as string object
		var cl = str.split(' ');//explode it by name
		if(cl[1]) {//h class should always be the second class (draggable, droppable are first)
			level = cl[1].toArray();//break string to array and get interger in h(x)
			level = level[1];
		}
		else{
			level = '0';
		}
		return parseFloat(level);
	},


	/**
	* This is the function called by the catrgoricalNodes form
	* It will pass the vars to php and have php set up a representative node in session
	* that will eventually be part of an XML file
	*
	* @param HTML_FORM form
	* @return void
	* @author Richard B. Mowatt <rmowatt@efashionsolutions.com>
	**/

	addCategoryName : function(form) {
		if($('navId').innerHTML == '0'){//no nav is selected
			alert('You have not yet defined a name for this Nav. \n Please click the link in the left hand corner to correct this issue and continue.');
			return false;
		}
		var error = false;//any errors will set this flag to true
		vars = $(form).getElements();
		var post = {};
		vars.each(function(el)
		{
			if(el.name != '_submit') {
				if(el.name == '_label' && el.value == '') {
					error = true;//set error to true so request wont send
				}
				post[el.name] = escape(el.value);//ad name value pair
			}
		}
		)
		post['_newWindow'] = ($('_newWindow').checked) ? 1 : 0;
		if(!error) {//make the request
			loadingBox();
			//post = $H(post);//convert obj to hash->toJSON for transport
			this.doAjax('/nav/ajaxaddcategoricalnodes/' ,'json=' + Object.toJSON(post), efsNav.submitNewNode);
		}
		else{//there was an error, make user fix!
			alert('please complete all fields');
			return false;
		}

	},

	/**
	*This is the function called by the groupNameNodes form
	*It will pass the vars to php and have php set up a representative node in session
	*that will eventually be part of an XML file
	*
	* @return void
	* @author Richard B. Mowatt <rmowatt@efashionsolutions.com>
	**/

	editGroupName : function() {
		//check our required fields
		var error = false;
		var required = $A(['nodeId', 'label']);
		required.each(function(id){
			if(!error && $(id).value == ''){
				alert('please complete all fields');
				error = true;
			}
		});
		if (error) {
			return false;
		}

		loadingBox();
		//		$('navOverlay').style.display = 'inline';

		if($('checkbox_sale').checked){
			var groupNameValue = 'sale-' + $('groupName').value;
		}
		else{
			var groupNameValue = ($('checkbox_all').checked) ? 'all-' + $('groupName').value : $('groupName').value;
		}

		var edits = {//lets get the info currently in the form
			nodeId: $('nodeId').value,
			label:  escape($('label').value),
			alt:    $('alt').value,
			title:    $('title').value,
			id:     $('navId').value,
			domId : $('domId').value,
			groupName: groupNameValue,
			newWindow : ($('checkbox_newWindow').checked) ? 1 : 0
		};
		var post = $H(edits);//convert obj to hash->toJSON for transport
		this.doAjax('/ajax/nav/edit/'+ $('nodeId').value ,'json=' + Object.toJSON(edits), efsNav.submitNewNode);
	},

	toggleMap : function() {
		var edits = {//lets get the info currently in the form
			status:  ($('sitemap').checked) ? '1' : '0',
			navId: $('navId').innerHTML
		}
		var post = $H(edits);
		this.doAjax('/nav/ajaxtogglesitemap' ,'json=' + Object.toJSON(edits), function(el){if(el.responseText == 'true'){EFS.ajaxStatus('Status Updated')}});
	},

	toggleDefaultDisplayAll : function() {
		var edits = {//lets get the info currently in the form
			status:  ($('defaultDisplayAll').checked) ? '1' : '0',
			navId: $('navId').innerHTML
		}
		var post = $H(edits);
		this.doAjax('/nav/ajaxtoggledefaultdisplayall' ,'json=' + Object.toJSON(edits), function(el){if(el.responseText == 'true'){EFS.ajaxStatus('Status Updated')}});
	},

	/**
	* This function takes the level of the (parent) droppable
	* adds 1 and then passes that as the new level for the child (draggable)
	*
	* @param Draggable drag
	* @param Droppable drop
	* @return void
	* @author Richard B. Mowatt <rmowatt@efashionsolutions.com>
	**/

	updateNodeClass : function(drag, drop) {
		hclass = this.parseForLevel(drop) + 1;
		if(hclass < 6){
			efsNav.createXMLNode(drag, drop, 'h'+hclass);//now create the node
		}
	},

	/**
	* Obviously this deletes a node, it also deletes all the nodes children
	*
	*
	* @param Draggable drag
	* @param Droppable drop
	* @return void
	* @author Richard B. Mowatt <rmowatt@efashionsolutions.com>
	**/

	deleteNode : function(drag, drop) {
		// here we have to make this recursive so that all children are updated
		if(drag.childElements()){
			drag.childElements().each(function(el){
				el.remove();
			})
		}
		drag.remove();
	},

	/**
	*I kept writing tons of recursion so heres a method to make it easier
	*
	* @author Richard B. Mowatt <rmowatt@efashionsolutions.com>
	**/

	recurse : function(element, callback) {
		if(element.childElements()) {
			element.childElements().each(
			callback
			)
		}
	},

	/**
	*Allows you to delete a node that you have already assigned
	*
	*
	* @param Draggable drag
	* @param Droppable drop
	* @return void
	* @author Richard B. Mowatt <rmowatt@efashionsolutions.com>
	**/

	deleteSingleNode : function(drag, drop) {
		if(drag.childElements()){
			drag.childElements().each(function(el){
				efsNav.updateNodeClass(el , drag.ancestors()[0] );
			})
		}
		drag.remove();
	},

	/**
	* prepopulated editor with info from droppable node
	*
	*
	* @param Draggable drag
	* @param Droppable drop
	* @return void
	* @author Richard B. Mowatt <rmowatt@efashionsolutions.com>
	**/

	replicateNode : function(drag, drop){
		efsNav.getPhpNodeInfo(drag.id, efsNav.populateGroupNameForm);
	},

	/**
	* is the efsNav currently in sortable mode ?
	*
	* @param Boolean isFalse
	**/

	isSortable : false,

	/**
	* Used to set the boolean value of isSortable
	*
	* @return void
	* @author Richard B. Mowatt <rmowatt@efashionsolutions.com>
	**/

	setSortable : function (){
		mess = (efsNav.isSortable)? 'Droppable' : "Sortable";
		$('mode').innerHTML = mess;
		efsNav.isSortable = (efsNav.isSortable)? false : true;
	},

	/**
	* toggles the nodes between sortable and droppable
	*
	* @param EXTENDED_ELEMENT div
	* @return void
	* @author Richard B. Mowatt <rmowatt@efashionsolutions.com>
	**/

	makeSortable : function(div) {
		// here we have to make this recursive so that all children are updated
		if(!$('ROOT')){//there is no root element yet so we cant sort
			return false;
		}

		if(this.isSortable){//user wants sortability
			if(div.childElements()) {
				div.childElements().each(
				function(el) {
					if(el.className != "omd"){
						efsNav.makeSortable(el);
					}
				}
				)
			}
			Droppables.remove(div.id);

			if(div.id != 'ROOT'){//we never wanna make ROOT sortable or droppable!
				new Draggable(div.id,{ revert: true, scroll: window, onStart : efsNav.OTFEdit.removeOTFEdit});
			}

			Sortable.create(div.id,{
				tag: 'div',  constraint: 'vertical', containment:div.id,
				onUpdate: function(draggable) {
				}
			}
			)
		}
		else{

			Sortable.destroy(div.id);

			if(div.id != 'ROOT'){
				new Draggable(div.id,{ revert: true, scroll: window, onStart : efsNav.OTFEdit.removeOTFEdit});
			}
			if(div.childElements()) {
				div.childElements().each(
				function(el) {
					if(el.className != "omd"){
						efsNav.makeSortable(el);
					}
				}
				)
			}
			if(div.id != 'ROOT'){
				Droppables.add(div.id,{
					overlap: 'vertical',
					accept: 'draggable',
					tag:'div',
					hoverclass: 'mouseoverdiv',
					onDrop: function(draggable, droppable, event) {
						efsNav.updateNodeClass(draggable, droppable);
					}
				});
			}
		}
	},

	/**
	* holds a representation of the node set in JSON,
	* This is what will eventually be sent to php for XML parsing
	*
	* @param HASH (yummy =) div
	**/

	nodeSetToJSON : $H(),

	/**
	* And now finally lets build our efsNav
	*
	* @param EXTENDED_ELEMENT div
	* @return void
	* @author Richard B. Mowatt <rmowatt@efashionsolutions.com>
	**/

	submitXML : function(div, callback){
		if($('navId').innerHTML == '0'){//havent chosen a nav yet
			alert('You have not yet defined a name for this Nav. \n Please click the link in the left hand corner to correct this issue and continue.');
			return false;
		}
		saveAndUpdate();

		if(!callback){callback = efsNav.confirmWrite}
		this.nodeSetToJSON  = $H(),
		this.parseToJSON(div);//this creates the JSON array
		//request info and apply callback
		this.doAjax('/nav/ajaxparsenodes/', 'navId='+ $('navId').innerHTML +'&json='+ this.nodeSetToJSON.toJSON(), callback);
	},

	/**
	* creates the JSON objects that are top be sent to php and turned to XML
	*
	* @param EXTENDED_ELEMENT div
	* @return void
	* @author Richard B. Mowatt <rmowatt@efashionsolutions.com>
	**/

	parseToJSON : function(div) {
		up = (div.up(0).id != undefined) ? div.up(0).id : '';//make suer up and down or defined to avoid errors
		down = (div.down()) ? div.down().id : '';
		var node = {//create a new JSON node to include in greater array
			id : div.id,
			className : div.className,
			level : efsNav.parseForLevel(div),
			parent :  up,
			firstChild :down
		};

		if(div.className != 'omd'){//avoid anything named OMD!
			this.nodeSetToJSON.set(div.id,Object.toJSON(node));
		}

		if(div.childElements()) {//apply recursively
			div.childElements().each(
			function(el) {
				if(el.className != "omd"){
					efsNav.parseToJSON(el);
				}
			});
		}
	},

	/**
	* Handler for SubmitXML
	*
	* @param JSON transport
	* @return void
	* @author Richard B. Mowatt <rmowatt@efashionsolutions.com>
	**/

	confirmWrite : function(transport) {
		origTxt = $('navOverlay').innerHTML;
		//		$('navOverlay').innerHTML = 'Saved Successfully!';
		//		Effect.DropOut('navOverlay' , { duration:2.5 , afterFinish : function(){$('navOverlay').style.display = 'none';$('navOverlay').innerHTML = origTxt;}});

		$('navOverlay').style.display = 'none';

		saveAndUpdate('doneClose');

		if(transport.responseText != 'fail'){
			efsNav.saveSiteMapTitle();
		}
		else{
			alert('There was an error with your submission. \n Please try again.');
		}
	},

	/**
	* Does all the lifting for nav creation
	*
	* @return void
	* @author Richard B. Mowatt <rmowatt@efashionsolutions.com>
	**/

	createNewNav : function(){
		params = {};
		//its a little tricky targeting elements in shaddowbox by id since it duplicates the code
		//so you have to get the particular instance by looping through shaddowbox children
		childs2 = $('shadowbox_content').descendants();
		childs2.each(function(el){
			if(el.name && el.name != ''){//this is the checkbox
				if(el.className == 'chkbx'){
					params.useCurrent = (el.checked) ? true : false;
				}
				else{
					if(el.value){//this is form value(s)
						params[el.id] = el.value
					}
				}
			}
		}
		)
		hParams = $H(params);//throw params to hash

		if(hParams.values().size() == 2){//there should be 2 paramaters picked up in the loop, otherwise forms incomplete
			childs = $('shadowbox_body').descendants();
			childs.each(function(el){//add new content to shaddowbox
				if(el.id == 'shadowbox_content'){
					el.innerHTML = '';
					e = new Element('div', {'class' : 'sbxStatus'});
					e.innerHTML = "Please wait while we submit your request..."
					el.insert({top : e});
				}
			}
			)
			sfk = $('siteFk').innerHTML;
			//send the request that readies everything for newest nav
			this.doAjax('/nav/ajaxaddnav/', 'inSbxName='+ params.inSbxName + '&currentSite='+sfk, function(transport){efsNav.updateForNewNav(transport , params.useCurrent)} );
		}
		else{//some fields were blank
			alert('Please complete All Fields');
		}
	},

	/**
	* Called if request to create a new nav is successful,
	* Actually called either way. If nav fails error message will appear
	*
	* @param
	* @return void
	* @author Richard B. Mowatt <rmowatt@efashionsolutions.com>
	**/

	updateForNewNav : function(transport , useCurrent) {
		rv = transport.responseText.toQueryParams();
		$('navId').innerHTML = rv.id;

		if(rv.id){//new id was passed out, query was succesful!

			$('shadowbox_content').innerHTML = '';
			e = new Element('img', {'src' : '/images/loader.gif'});
			f = new Element('div', {'class' : 'sbxMyContent'});
			//keep user up to date of status so they dont go click crazy
			f.innerHTML = "Request Successful! New nav will load momentarily...";
			f.insert({bottom : e});
			$('shadowbox_content').insert({top : f});

			if(useCurrent && $('ROOT')){//there is a nav instance there and user wants to start from that point
				efsNav.submitXML($('ROOT') , function(transport){window.location = '/nav/edit/' + rv.id;});
			}
			else{//just redirect
				location.href = '/nav/edit/' + rv.id;
			}
		}
		else{//there was an error, inform user
			//alert(transport.responseText.stripTags());
			f = new Element('div', {'class' : 'sbxStatus'});
			f.innerHTML = "Your request has failed. Please close this box and try again.<br />If you continue to have issues please contact Support with a detailed account of your problem.";
			$('shadowbox_content').insert({top : f});
		}

	},

	/**
	*	Sends the ajax call to set the site map title
	*/
	saveSiteMapTitle : function() {
		if ($('siteMapTitle').value != '') {
			// only do it if we actually have a value
			efsNav.doAjax(
				'/nav/ajaxsavesitemaptitle',
				'siteMapTitle='+ $('siteMapTitle').value + '&navId=' + $('navId').innerHTML,
				function(transport) {
					// callback does nothing
				}
			);
		}
	},

	/**
	* Sends the ajax call to delete a nav from the database
	* if successful redirects user to default page
	*
	* @return void
	* @author Richard B. Mowatt <rmowatt@efashionsolutions.com>
	**/

	deleteNav : function(){
		if(confirm('Are you sure you want to delete this efsNav? \n This action cannot be undone!')){
			efsNav.doAjax('/nav/ajaxdeletenav/', 'navId='+ $('navId').innerHTML, function(){
				loc = location.href;
				st = '/'+$('navId').innerHTML;
				loca = loc.sub(st, '');
				window.location = loca;
			} )
		}
	},

	/**
	* If you're reading this you should probably know what init means
	*
	* @return void
	* @author Richard B. Mowatt <rmowatt@efashionsolutions.com>
	**/
	init : function(){

		if($('ROOT')){//no need to init if its and empty page
			Droppables.add('dropBox',{
				onDrop: function(draggable, droppable, event) {
					if(!$('ROOT')){
						el = new Element('div' , {'id' : 'ROOT' , 'class' : 'omd clear'});
						$('binder').insert({after : el});
					}

					efsNav.updateNodeClass(draggable, droppable);
					//alert('added to xml2');
				}
			});

			Droppables.add('trash',{
				onDrop: function(draggable, droppable, event) {
					efsNav.deleteNode(draggable, droppable);
				}
			});

			Droppables.add('trashOne',{
				onDrop: function(draggable, droppable, event) {
					efsNav.deleteSingleNode(draggable, droppable);
				}
			});


			/*
			Droppables.add('replicate',{
			onDrop: function(draggable, droppable, event) {
			efsNav.replicateNode(draggable, droppable);
			}
			});
			*/


			this.makeSortable($('ROOT'));//add js to the elements


			Event.observe(document , 'keydown', efsNav.keyListener.makeSortable)
			Event.observe(document , 'keyup',   efsNav.keyListener.makeDroppable);

			$R(1, 7, true).each(function(value){//add dbl click listeners to all current nodes
				els = $A(document.getElementsByClassName("h"+value));
				els.each(function(el){
					Event.observe(el, 'dblclick', function(event) {
						if(event.element().id == el.id){
							if(!efsNav.keyListener.getIsDown()){
								efsNav.OTFEdit.openOTFEdit(el.id)
							}
						}
						return false;
					});
				});
			});

			if($('navDelete')){
				Event.observe('navDelete' , 'click', efsNav.deleteNav);
			}
			Event.observe('sub', 'click', function(e){efsNav.submitXML($('ROOT'))});
			Event.observe('checkbox_sale' , 'click', function(e){if($('checkbox_all').checked){$('checkbox_all').checked = false;}});
			Event.observe('checkbox_all' , 'click', function(e){if($('checkbox_all').checked){$('checkbox_sale').checked = false;}});
		}

		efsNav.shaddowbox = Shadowbox.init({'enableKeys' : false , 'onFinish' : showFromCurrent , 'modal' : false});//instantiate instance of shaddowbox

		return this;
	}
	,

	/*******************************************************************************
	efsNav.OTFEdit Object
	*******************************************************************************/

	/**
	* OTFEdit is a class within efsNav that handles all
	* actions concerning the OTFEdit functionality that
	* occours when you double click on a node
	*
	* @author Richard B. Mowatt <rmowatt@efashionsolutions.com>
	**/

	OTFEdit : {

		/**
		* Checks to see if there is an OTF box currently open and if so removes it w/ no theatrics
		*
		* @return void
		* @author Richard B. Mowatt <rmowatt@efashionsolutions.com>
		**/

		removeOTFEdit : function(){
			if($('editOnFlyForm')){//make sure el exists
				$('editOnFlyForm').remove();
				if($('clearBar')){
					$('clearBar').remove()
				}
			}
		},

		/**
		* Checks to see if there is an OTF box currently open and if so closes it
		*
		* @return void
		* @author Richard B. Mowatt <rmowatt@efashionsolutions.com>
		**/

		closeOTFEdit : function(){
			if($('editOnFlyForm')){//make sure el exists
				new Effect.BlindUp($('editOnFlyForm'), {//get fantabulous
					duration: 0.5,
					afterFinish  : function(){
						$('editOnFlyForm').remove();
						if($('clearBar')){
							$('clearBar').remove()
						}
					}
				});
			}
		},

		/**
		* All the fun parts blah blah.
		* This is basically tha factory where the form is created and populated
		* The elemnt is then passed along for display
		*
		* @param transport JSON
		* @return DOM Element
		* @author Richard B. Mowatt <rmowatt@efashionsolutions.com>
		**/

		createEditNode : function(transport){
			json = transport.responseText.evalJSON();
			json = json.node;
			//alert(transport.responseText)
			nodeIdValue = transport.responseText.evalJSON().nodeId;

			if($('editOnFlyForm')){$('editOnFlyForm').remove()}
			if($('clearBar')){$('clearBar').remove()}

			label = new Element('input' , {'type' : 'text' , 'name' : 'eLabel' , 'id' : 'eLabel' ,'value' : json._label});
			alt = new Element('input' , {'type' : 'text' , 'name' : 'eAlt' , 'id' : 'eAlt' ,'value' : json._alt});
			title = new Element('input' , {'type' : 'text' , 'name' : 'eTitle' , 'id' : 'eTitle' ,'value' : json._title});
			dom = new Element('input' , {'type' : 'text' , 'name' : 'eDom' , 'id' : 'eDom' ,'value' : json._domId});
			link = new Element('input' , {'type' : 'text' , 'name' : 'eLink' , 'id' : 'eLink' ,'value' : json._link});
			newWin = (json._newWindow && json._newWindow != 'false')?1:0;
			var chkbxObj = {'type' : 'checkbox' , 'name' : 'eNewWindow' , 'id' : 'eNewWindow', 'style' : 'width:25px;'};
			if(json._newWindow && json._newWindow != 0 && json._newWindow != 'false') chkbxObj.checked = 1;
			newWinEl = new Element('input' , chkbxObj);
			el = new Element('p', {'class' : 'edit' , 'style' : 'clear:both;visibility:hidden', 'id' : 'editOnFlyForm'});


			ul = new Element('ul');

			li = new Element('li');
			div = new Element('div');
			div.innerHTML = 'Label : ';
			li.insert({top : label});
			li.insert({top : div});

			li1 = new Element('li');
			div1 = new Element('div');
			div1.innerHTML = 'Alt Txt : ';
			li1.insert({top : alt});
			li1.insert({top : div1});

			liT = new Element('li');
			divT = new Element('div');
			divT.innerHTML = 'Title Txt : ';
			liT.insert({top : title});
			liT.insert({top : divT});

			li2 = new Element('li');
			div2 = new Element('div');
			li2.insert({top : dom});
			div2.innerHTML = 'Dom Id : ';
			li2.insert({top : div2});

			if(!json._groupName){
				li4 = new Element('li');
				div4 = new Element('div');
				li4.insert({top : link});
				div4.innerHTML = 'Link : ';
				li4.insert({top : div4});
			}

			li5 = new Element('li');
			div5 = new Element('div', {'style' : 'width:85px;'});
			li5.insert({top : newWinEl});
			div5.innerHTML = 'New Window : ';
			li5.insert({top : div5});

			cancel = new Element('div', {'id' : 'OTFEditCancel'});
			cancel.innerHTML = 'Cancel'

			editBtn = new Element('div', {'id' : 'OTFSubmit'});
			editBtn.innerHTML = 'Submit';

			clearBar = new Element('div', {'id' : 'clearBar'});
			div3 = new Element('div' ,{'style' : 'width:400px;padding-left:140px;'});
			div3.insert({top : editBtn});
			div3.insert({top : cancel});

			hiddenId = new Element('input', {'type' : 'hidden' , 'value' : nodeIdValue , 'id' : 'EOFNodeId'});

			ul.insert({top : hiddenId});
			ul.insert({top : li5});
			if(!json._groupName){
				ul.insert({top : li4});
			}
			ul.insert({top : li2});
			ul.insert({top : li1});
			ul.insert({top : liT});
			ul.insert({top : li});


			//p= new Element('p');
			el.insert({top : div3});
			el.insert({top : ul});
			//el.insert({top : p});

			return el;
		},

		/**
		* Trickery, trickery. Just a little way of snazzing up the OTF display
		*Closes any preexisting EOF boxes then starts the process of opening the xew one
		*
		* @param elId // id of the element to be opened
		* @return void
		* @author Richard B. Mowatt <rmowatt@efashionsolutions.com>
		**/

		openOTFEdit : function(elId){
			if($('editOnFlyForm')){
				new Effect.BlindUp($('editOnFlyForm'), {
					duration: 0.5,
					afterFinish  : function(){efsNav.getPhpNodeInfo(elId , efsNav.OTFEdit.populateEditOnFly);}
				});}
				else{
					efsNav.getPhpNodeInfo(elId , efsNav.OTFEdit.populateEditOnFly);
				}
		},

		/**
		* displays and populates the form that appears for OTFedit tool
		*
		* @param transport JSON
		* @return void
		* @author Richard B. Mowatt <rmowatt@efashionsolutions.com>
		**/

		populateEditOnFly : function(transport){
			//alert(transport.responseText);
			$('navOverlay').style.display = 'none';
			json = transport.responseText.evalJSON().node;
			nodeId = transport.responseText.evalJSON().nodeId;

			var node = efsNav.OTFEdit.createEditNode(transport);
			if(json._class){
				//node.className = json._class;
			}
			el = $(nodeId);
			clearBar = new Element('div', {'id' : 'clearBar'});

			sib = el.nextSiblings()[0];
			if(sib && el.descendants().size() < 1){
				//alert('case1');
				sib.insert({top : node});
				node.insert({after : clearBar});
				new Effect.BlindDown(node, {
					duration: 0.5,
					afterUpdate  : function(){node.style.visibility = 'visible'; afterUpdate = null;}
				});
				efsNav.OTFEdit.setObservers();
				return true;
			}

			if(el.descendants().size() > 0){
				//alert('case2');
				//node.style.margin = "-10px";
				//node.style.paddingTop = ".5em"
				//node.style.paddingBottom = ".5em"
				el.descendants()[0].insert({top : node});
				node.insert({after : clearBar});
				new Effect.BlindDown(node, {
					duration: 0.5,
					afterUpdate  : function(){node.style.visibility = 'visible'; afterUpdate = null;}
				});
				efsNav.OTFEdit.setObservers();
				return true;
			}
			else{
				//alert('case3');
				el.insert({bottom : node});
				node.insert({after : clearBar});
				new Effect.BlindDown(node, {
					duration: 0.5,
					afterUpdate  : function(){
						node.style.visibility = 'visible'; afterUpdate = null;
					}
				});
				efsNav.OTFEdit.setObservers();
				return true;
			}
		},

		/**
		* Sets the event handlers on the OTFEdit tool
		*
		* @return void
		* @author Richard B. Mowatt <rmowatt@efashionsolutions.com>
		**/

		setObservers : function(){
			Event.observe('OTFEditCancel', 'click', function(event) {
				efsNav.OTFEdit.closeOTFEdit();
			});

			Event.observe($('OTFSubmit'), 'click', function(event) {
				efsNav.OTFEdit.updateOTFEdit();
			});
		}
		,

		/**
		*This is the method called by an OnTheFly edit box
		*It checks required fields are complete and
		*if they are calls efsNav.renderUpdate
		*
		* @return mixed void || boolean
		* @author Richard B. Mowatt <rmowatt@efashionsolutions.com>
		**/

		updateOTFEdit : function(){
			var error = false;//if there are errors we will alert instead
			//check our required fields
			var required = $A(['eLabel']);
			required.each(function(el){
				if($(el).value == ''){
					error = true;//uh oh! error
				}
			}
			);
			//now we check the state of error and decide what to do
			if(!error) {
				$('navOverlay').style.display = 'inline';
				//currentNodeId = $('id').value;
				var eLink =  ($('eLink')) ? $('eLink').value : null;
				var edits = {//lets get the info currently in the form
					nodeId: $('EOFNodeId').value,
					label:  escape($('eLabel').value),
					alt:   	($('eAlt').value != '#_#') ? $('eAlt').value : '',
					title:    ($('eTitle').value  != '#_#') ? $('eTitle').value : '',
					domId: $('eDom').value,
					newWindow : ($('eNewWindow').checked) ? '1' : '0',
					link : eLink
					//id:     $('id').value
					//groupName: $('groupName').value
				};
				var post = $H(edits);//convert obj to hash->toJSON for transport
				efsNav.doAjax('/ajax/nav/edit/'+ $('EOFNodeId').value,'json=' + Object.toJSON(edits), efsNav.OTFEdit.rendertOTFUpdate )
			}
			else{//make user fix form!
				alert('please complete all fields');
				return false;
			}
		},

		/**
		*A handler method for update OTFEdit
		*
		* @param JSON transport
		* @return void
		* @author Richard B. Mowatt <rmowatt@efashionsolutions.com>
		**/

		rendertOTFUpdate : function(transport) {
			json = transport.responseText.evalJSON().node;
			nodeId = transport.responseText.evalJSON().nodeId;
			$('navOverlay').style.display = 'none';
			efsNav.OTFEdit.closeOTFEdit();
			gn = (json._groupName) ? ' - ('+json._groupName+')' : ' - (category)';
			$(nodeId).childNodes[0].nodeValue = json._label + gn;
		}

	},

	/**********************************************************
	efsNav.keyListener Object
	*********************************************************/

	/**
	* Key Listener Object Will listen for key events and react accordingly.
	* For the most part it controlls the switch between Droppable and Sortable
	*
	* @author Richard B. Mowatt <rmowatt@efashionsolutions.com>
	**/

	keyListener : {
		isDown : false,

		/**
		* function returns the value of efsnav.keyListener.isDown
		*
		* @return boolean
		* @author Richard B. Mowatt <rmowatt@efashionsolutions.com>
		**/

		getIsDown : function(){
			return this.isDown
		},

		/**
		* displays and populates the form that appears for OTFedit tool
		*
		* @param e DOMEvent
		* @return mixed INT : CHARDATA
		* @author Richard B. Mowatt <rmowatt@efashionsolutions.com>
		**/

		getKeyNum : function(e){
			var keynum;
			var keychar;
			var numcheck;
			if(window.event) // IE
			{
				keynum = e.keyCode;
			}
			else if(e.which) // Netscape/Firefox/Opera
			{
				keynum = e.which;
			}
			return keynum;
			numcheck = /\d/;
		},

		/**
		* Sets isDown value, removes any existing edit boxes
		* And makes nav SORTABLE
		*
		* @param e DOMEvent
		* @return void
		* @author Richard B. Mowatt <rmowatt@efashionsolutions.com>
		**/

		makeSortable : function(e) {
			keynum = efsNav.keyListener.getKeyNum(e);
			if(keynum == 18 && !efsNav.keyListener.isDown){
				efsNav.OTFEdit.removeOTFEdit();
				efsNav.setSortable();
				efsNav.makeSortable($('ROOT'));
				efsNav.keyListener.isDown = true;
			}
		},

		/**
		* Sets isDown value
		* And makes nav DROPPABLE
		*
		* @param e DOMEvent
		* @return void
		* @author Richard B. Mowatt <rmowatt@efashionsolutions.com>
		**/

		makeDroppable : function(e) {
			keynum = efsNav.keyListener.getKeyNum(e);
			if(keynum == 18 && efsNav.keyListener.isDown){
				efsNav.setSortable();
				efsNav.makeSortable($('ROOT'));
				efsNav.keyListener.isDown = false;
			}
		}

	}
}

var showFromCurrent = function(el){
	vis = ($('navId').innerHTML == '0') ? 'none' : 'inline';
	$('shadowbox_content').descendants().each(function(el){
		if(el.id && el.id == 'startFromCurrent'){
			el.style.display = vis;
		}
	})
}

EFS.onDomReady(function() {

	navigation = efsNav.init();

});
