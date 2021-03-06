/*
 * Copyright (c) 2012-2014 Axelor. All Rights Reserved.
 *
 * The contents of this file are subject to the Common Public
 * Attribution License Version 1.0 (the “License”); you may not use
 * this file except in compliance with the License. You may obtain a
 * copy of the License at:
 *
 * http://license.axelor.com/.
 *
 * The License is based on the Mozilla Public License Version 1.1 but
 * Sections 14 and 15 have been added to cover use of software over a
 * computer network and provide for limited attribution for the
 * Original Developer. In addition, Exhibit A has been modified to be
 * consistent with Exhibit B.
 *
 * Software distributed under the License is distributed on an “AS IS”
 * basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See
 * the License for the specific language governing rights and limitations
 * under the License.
 *
 * The Original Code is part of "Axelor Business Suite", developed by
 * Axelor exclusively.
 *
 * The Original Developer is the Initial Developer. The Initial Developer of
 * the Original Code is Axelor.
 *
 * All portions of the code written by Axelor are
 * Copyright (c) 2012-2014 Axelor. All Rights Reserved.
 */
(function(){

var ui = angular.module('axelor.ui');

/**
 * The Form widget.
 *
 */
ui.formWidget('Form', {

	priority: 100,
	
	css: "dynamic-form",
	
	scope: false,
	
	compile: function(element, attrs) {

		element.hide();
		element.find('[x-field],[data-field]').each(function(){
			
			var elem = $(this),
				name = elem.attr('x-field') || elem.attr('data-field');
				
			if (name && elem.attr('ui-button') === undefined) {
				if (!elem.attr('ng-model')) {
					elem.attr('ng-model', 'record.' + name);
				}
				if (!elem.attr('ng-required')) {
					// always attache a required validator to make
					// dynamic `required` attribute change effective
					elem.attr('ng-required', false);
				}
			}
		});
		
		return ui.formCompile.apply(this, arguments);
	},
	
	link: function(scope, element, attrs, controller) {
		
		element.on('submit', function(e) {
			e.preventDefault();
		});

		scope.$watch('record', function(rec, old) {
			if (element.is(':visible')) {
				return;
			}
			scope.ajaxStop(function() {
				element.show();
				axelor.$adjustSize();
			});
		});
	}
});

/**
 * This directive is used filter $watch on scopes of inactive tabs.
 *
 */
ui.directive('uiTabGate', function() {

	return {
		
		compile: function compile(tElement, tAttrs) {
			
			return {
				pre: function preLink(scope, element, attrs) {
					scope.$watchChecker(function(current) {
						if (current.tabSelected === undefined) {
							return !scope.tab || scope.tab.selected === undefined || scope.tab.selected;
						}
						return current.tabSelected;
					});
				}
			};
		}
	};
});

/**
 * This directive is used to filter $watch on scopes of hidden forms.
 *
 */
ui.directive('uiFormGate', function() {

	return {
		compile: function compile(tElement, tAttrs) {

			return {
				pre: function preLink(scope, element, attrs) {
					var parent = null;
					scope.$watchChecker(function(current) {
						if (scope.tabSelected === false) {
							return false;
						}
						if (parent === null) {
							parent = element.parents('[ui-show]:first');
						}
						return !(parent.hasClass('ui-hide') || parent.hasClass('ui-hide'));
					});
				}
			};
		}
	};
});

/**
 * This directive is used to filter $watch on scopes based on some condition.
 *
 */
ui.directive('uiWatchIf', ['$parse', function($parse) {
	
	return {
		compile: function compile(tElement, tAttrs) {
			return {
				pre: function preLink(scope, element, attrs) {
					var value = false,
						expression = $parse(attrs.uiWatchIf);
					
					scope.$watchChecker(function (current) {
						if (current === scope) {
							return value = expression(scope);
						}
						return value;
					});
				}
			};
		}
	};
}]);

function toBoolean(value) {
	if (value && value.length !== 0) {
		var v = angular.lowercase("" + value);
		value = !(v == 'f' || v == '0' || v == 'false' || v == 'no' || v == 'n' || v == '[]');
	} else {
		value = false;
	}
	return value;
}

/**
 * This directive is used to speedup uiFormGate.
 */
ui.directive('uiShow', function() {

	return {
		scope: true, // create new scope to always watch the expression
		link: function link(scope, element, attrs) {
			scope.$$shouldWatch = true;
			scope.$watch(attrs.uiShow, function uiShowWatchAction(value){
				element.css('display', toBoolean(value) ? '' : 'none').toggleClass('ui-hide', !toBoolean(value));
			});
		}
	};
});

ui.directive('uiWidgetStates', ['$parse', function($parse) {

	function isValid(scope, name) {
		if (!name) return scope.isValid();
		var ctrl = scope.form;
		if (ctrl) {
			ctrl = ctrl[name];
		}
		if (ctrl) {
			return ctrl.$valid;
		}
	}
	
	function handleCondition(scope, field, attr, condition, negative) {

		if (!condition) {
			return;
		}

		scope.$on("on:record-change", function(e, rec) {
			if (rec === scope.record) {
				handle(rec);
			}
		});

		scope.$watch("isReadonly()", watcher);
		scope.$watch("isRequired()", watcher);
		scope.$watch("isValid()", watcher);
		
		var expr = $parse(condition);

		function watcher(current, old) {
			if (current !== old) handle(scope.record);
		}

		function handle(rec) {
			var value = undefined;
			try {
				value = axelor.$eval(scope, expr, rec);
			} catch (e) {}
			scope.attr(attr, negative ? !value : value);
		}
	}
	
	function handleHilites(scope, field) {
		if (!field || _.isEmpty(field.hilites)) {
			return;
		}
		
		var hilites = field.hilites || [];
		var exprs = _.map(_.pluck(hilites, 'condition'), $parse);

		function handle(rec) {
			for (var i = 0; i < hilites.length; i++) {
				var hilite = hilites[i];
				var expr = exprs[i];
				var value = false;
				try {
					value = axelor.$eval(scope, expr, rec);
				} catch (e) {}
				if (value) {
					return scope.attr('highlight', {
						hilite: hilite,
						passed: value
					});
				}
			}
			return scope.attr('highlight', {});
		}
		
		scope.$on("on:record-change", function(e, rec) {
			if (rec === scope.record) {
				handle(rec);
			}
		});
	}
	
	function handleFor(scope, field, attr, conditional, negative) {
		if (field[conditional]) {
			handleCondition(scope, field, attr, field[conditional], negative);
		}
	}
	
	function handleForField(scope) {
		var field = scope.field;
		if (!field) return;
		handleFor(scope, field, "valid", "validIf");
		handleFor(scope, field, "hidden", "hideIf");
		handleFor(scope, field, "hidden", "showIf", true);
		handleFor(scope, field, "readonly", "readonlyIf");
		handleFor(scope, field, "required", "requiredIf");
		handleFor(scope, field, "collapse", "collapseIf");
		handleHilites(scope, scope.field);
	}
	
	function handleForView(scope) {
		var field = scope.schema;
		if (!field) return;
		handleFor(scope, field, "canNew", "canNew");
		handleFor(scope, field, "canEdit", "canEdit");
		handleFor(scope, field, "canSave", "canSave");
		handleFor(scope, field, "canCopy", "canCopy");
		handleFor(scope, field, "canDelete", "canDelete");
		handleFor(scope, field, "canAttach", "canAttach");
	}
	
	return function(scope, element, attrs) {
		scope.$evalAsync(function() {
			if (element.is('[ui-form]')) {
				return handleForView(scope);
			}
			handleForField(scope);
		});
	};
}]);

})(this);
