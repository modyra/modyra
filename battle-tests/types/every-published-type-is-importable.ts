/**
 * Every published type is one a consumer can import and write down.
 *
 * A type is exercised by a check that compiles against it as surely as a function is by one that
 * calls it — and until this file existed, two hundred and seventy-four published names were exercised
 * by nothing at all. What each line asserts is the floor: the name is reachable from the door a
 * consumer would knock on, and it can stand in a type position. A name that stops being exported, or
 * stops being a type, stops compiling here.
 *
 * **Not the shape.** What the members of each type are is recorded in `type-surface.json` and guarded
 * by its own audit, which classifies a change rather than forbidding one. Restating the members here
 * would be a second copy of that record, drifting the moment either moved.
 *
 * Generated from the names the coverage audit reports as asserted by nothing; regenerate rather than
 * edit by hand.
 */
/* eslint-disable @typescript-eslint/no-unused-vars */

import type {
  MdyAccessibleNameSource,
  MdyAffordance,
  MdyAffordanceRole,
  MdyAnchorRect,
  MdyAnchoredOverlayTracking,
  MdyAnnouncer,
  MdyBooleanFieldA11yOptions,
  MdyBooleanFieldController,
  MdyBooleanFieldControllerOptions,
  MdyBooleanFieldIntent,
  MdyBooleanFieldState,
  MdyBooleanFieldVariant,
  MdyCalendarPeriodCell,
  MdyCalendarViewA11yOptions,
  MdyCatalogWidgetIntent,
  MdyCatalogWidgetState,
  MdyChipAppearance,
  MdyChipMode,
  MdyChipPart,
  MdyChipRole,
  MdyColorValueIntent,
  MdyColorValueTransition,
  MdyColorsFieldController,
  MdyColorsFieldControllerOptions,
  MdyColorsFieldIntent,
  MdyColorsFieldPreset,
  MdyColorsFieldState,
  MdyCommandDefer,
  MdyCommandRuntime,
  MdyCommandRuntimeOptions,
  MdyCommandTarget,
  MdyControllerNotify,
  MdyDateDraftIntent,
  MdyDateDraftState,
  MdyDateDraftTransition,
  MdyDateRangeDraftIntent,
  MdyDateRangeDraftState,
  MdyDateRangeDraftTransition,
  MdyDateRangeValue,
  MdyDateValueIntent,
  MdyDatepickerFieldA11yOptions,
  MdyDatepickerFieldCell,
  MdyDatepickerFieldControllerOptions,
  MdyDatepickerFieldIntent,
  MdyDatepickerFieldState,
  MdyDaterangeFieldA11yOptions,
  MdyDaterangeFieldCell,
  MdyDaterangeFieldControllerOptions,
  MdyDaterangeFieldIntent,
  MdyDaterangeFieldState,
  MdyDismissalBindingOptions,
  MdyDismissalPhase,
  MdyDragPoint,
  MdyElementTarget,
  MdyFieldShellA11yOptions,
  MdyFieldShellFlags,
  MdyFieldShellPart,
  MdyFieldVerdictSource,
  MdyFileCandidate,
  MdyFileFieldController,
  MdyFileFieldControllerOptions,
  MdyFileFieldIntent,
  MdyFileFieldState,
  MdyFileSelectionOptions,
  MdyFileSelectionTransition,
  MdyFocusCustodian,
  MdyFormResetBinding,
  MdyFormShellPart,
  MdyGranularityProblem,
  MdyKeyBinding,
  MdyKeyOrPress,
  MdyLayoutBreakpoint,
  MdyLayoutColumnCounts,
  MdyLayoutPart,
  MdyLayoutSlotPlacement,
  MdyLightDismiss,
  MdyLightDismissOptions,
  MdyMultiselectFieldA11yOptions,
  MdyMultiselectFieldController,
  MdyMultiselectFieldControllerOptions,
  MdyMultiselectFieldIntent,
  MdyMultiselectFieldState,
  MdyMultiselectOverlayAction,
  MdyMultiselectValueIntent,
  MdyMultiselectWayBack,
  MdyNativeAttributes,
  MdyOpenModality,
  MdyOptionFieldA11yOptions,
  MdyOptionFieldController,
  MdyOptionFieldControllerOptions,
  MdyOptionFieldIntent,
  MdyOptionFieldState,
  MdyOptionFieldVariant,
  MdyOptionNavigationTarget,
  MdyOutsideDismiss,
  MdyOverlayAnchorOptions,
  MdyOverlayAnchoring,
  MdyOverlayGeometry,
  MdyOverlayLifecycleState,
  MdyOverlayLifecycleTransition,
  MdyOverlayOpenerA11yOptions,
  MdyOverlayPhase,
  MdyOverlayPlacementResult,
  MdyOverlayProperty,
  MdyOverlayRoot,
  MdyPartMap,
  MdyPartPresence,
  MdyPartState,
  MdyPointerDrag,
  MdyPointerDragOptions,
  MdyPointerOrigin,
  MdyRelationAttribute,
  MdySelectA11yOptions,
  MdySelectA11yProjection,
  MdySelectController,
  MdySelectControllerOptions,
  MdySelectKeyboardAction,
  MdySelectMoveTarget,
  MdySelectReconciliationState,
  MdySilentWriteBinding,
  MdyStateName,
  MdySubmissionShape,
  MdyTextFieldA11yOptions,
  MdyTextFieldControllerOptions,
  MdyTextFieldIntent,
  MdyTimeClockIntent,
  MdyTimeDraftIntent,
  MdyTimeDraftState,
  MdyTimeDraftTransition,
  MdyTimeEntry,
  MdyTimeField,
  MdyTimeFieldBounds,
  MdyTimeRejection,
  MdyTimeWindow,
  MdyTimepickerDialArc,
  MdyTimepickerDialGhost,
  MdyTimepickerDialKeyResult,
  MdyTimepickerDialNumber,
  MdyTimepickerDialPick,
  MdyTimepickerEntry,
  MdyTimepickerFieldA11yOptions,
  MdyTimepickerFieldController,
  MdyTimepickerFieldControllerOptions,
  MdyTimepickerFieldState,
  MdyTransitionTrigger,
  MdyTypeahead,
  MdyTypeaheadOptions,
  MdyTypedWidgetViewContract,
  MdyValueWidgetControllerOptions,
  MdyValueWidgetState,
  MdyViewportSize,
  MdyVocabulary,
  MdyVocabularyShape,
  MdyWidgetCommandContext,
  MdyWidgetCommandExecutor,
  MdyWidgetController,
  MdyWidgetDefinition,
  MdyWidgetIdFactory,
  MdyWidgetKeyIntent,
  MdyWidgetRelation,
  MdyWidgetRuntimeCapabilities,
  MdyWidgetSemanticElement,
  MdyWidgetState,
  MdyWidgetStateContract,
  MdyWidgetStructure,
  MdyWidgetStructureNode,
  MdyWidgetTransition,
  MdyWidgetVariant,
  MdyWidgetViewContract,
} from "@modyra/widgets";

import type {
  MdyAsyncValidationContext,
  MdyBatchingCapability,
  MdyContextRef,
  MdyCoreFormOptions,
  MdyDiagnosticSeverity,
  MdyDynamicArrayNode,
  MdyDynamicBooleanField,
  MdyDynamicCalendarOptions,
  MdyDynamicCollection,
  MdyDynamicColorsField,
  MdyDynamicColumns,
  MdyDynamicDateField,
  MdyDynamicDaterangeField,
  MdyDynamicFieldNode,
  MdyDynamicFileField,
  MdyDynamicFlatForm,
  MdyDynamicFormConfig,
  MdyDynamicFormConfigV2,
  MdyDynamicFormConfigV3,
  MdyDynamicFormDocument,
  MdyDynamicFormParseResult,
  MdyDynamicGroupNode,
  MdyDynamicNode,
  MdyDynamicNumberField,
  MdyDynamicOptionsField,
  MdyDynamicRecordNode,
  MdyDynamicRule,
  MdyDynamicRuleOperator,
  MdyDynamicSection,
  MdyDynamicTextField,
  MdyDynamicValidation,
  MdyDynamicValidators,
  MdyEqualityFn,
  MdyExpression,
  MdyExpressionOp,
  MdyExpressionScope,
  MdyFieldKind,
  MdyFlushCapability,
  MdyFormEngineOptions,
  MdyObserveCapability,
  MdyObserveOptions,
  MdyOperand,
  MdyPathGate,
  MdyPathRef,
  MdyReactivityCapabilities,
  MdyRootRef,
  MdySanitizeProfile,
  MdyScopeOptions,
  MdySecurityViolation,
  MdySecurityViolationKind,
  MdySelfRef,
  MdyServerValidatorOptions,
  MdySubmittedItemValue,
  MdyValidationMessages,
  MdyValidatorFacts,
  MdyValueCommit,
  MdyValueContract,
  MdyValueSecurityResult,
  MdyValueShape,
  MdyWebStorageLike,
  MdyDynamicBreakpoint,
  MdyDynamicSlotPlacement,
  MdyDraftStorage,
} from "@modyra/core";

import type {
  MdyCalendarIssue,
  MdyCalendarIssueCode,
  MdyCanonicalOptions,
  MdyCanonicalOverlay,
  MdyCanonicalPart,
  MdyCanonicalRelationship,
  MdyCanonicalSnapshot,
  MdyDomContractIssue,
  MdyDomContractIssueCode,
  MdyDomContractOptions,
  MdyDomPartMap,
  MdyLifecycleIssue,
  MdyLifecycleIssueCode,
  MdyLifecycleTransition,
  MdyPaintBeat,
  MdySelectTransitionFixture,
  MdyStateInspectOptions,
  MdyStateIssue,
  MdyStateIssueCode,
  MdyStateMatrixOptions,
  MdyStateMatrixResult,
  MdyStateMatrixRow,
  MdyStructureContractIssue,
  MdyTestingVocabulary,
  MdyUnmountObservation,
  assertWidgetStructureContract,
  expectedWeekdayOrder,
  inspectUnsupportedStateAria,
} from "@modyra/widgets/testing";

import type {
  MdySnapshotOptions,
} from "@modyra/core/devtools";

import type {
  MdyAsyncDraftStorage,
  MdyAsyncDraftStorageOptions,
  MdyAsyncKeyValueStore,
} from "@modyra/core/async-draft-storage";

import type {
  MdyReactivityTestHarness,
} from "@modyra/core/testing";

import type {
  addDays,
  addYears,
  firstWeekday,
  getPointerCoords,
  localeDateOrder,
  parse24Time,
  ParsedTime,
  angleToHour,
  angleToMinute,
} from "@modyra/core/datetime";

import type { MdyCvaDirective } from "@modyra/angular/interop";

/** Each name, stood in a type position so its absence is a compile error. */
declare const heldCva: MdyCvaDirective;
void heldCva;
declare const held1: MdyAccessibleNameSource;
void held1;
declare const held2: MdyAffordance;
void held2;
declare const held3: MdyAffordanceRole;
void held3;
declare const held4: MdyAnchorRect;
void held4;
declare const held5: MdyAnchoredOverlayTracking;
void held5;
declare const held6: MdyAnnouncer;
void held6;
declare const held7: MdyBooleanFieldA11yOptions;
void held7;
declare const held8: MdyBooleanFieldController;
void held8;
declare const held9: MdyBooleanFieldControllerOptions;
void held9;
declare const held10: MdyBooleanFieldIntent;
void held10;
declare const held11: MdyBooleanFieldState;
void held11;
declare const held12: MdyBooleanFieldVariant;
void held12;
declare const held13: MdyCalendarPeriodCell;
void held13;
declare const held14: MdyCalendarViewA11yOptions;
void held14;
declare const held15: MdyCatalogWidgetIntent;
void held15;
declare const held16: MdyCatalogWidgetState;
void held16;
declare const held17: MdyChipAppearance;
void held17;
declare const held18: MdyChipMode;
void held18;
declare const held19: MdyChipPart;
void held19;
declare const held20: MdyChipRole;
void held20;
declare const held21: MdyColorValueIntent;
void held21;
declare const held22: MdyColorValueTransition;
void held22;
declare const held23: MdyColorsFieldController;
void held23;
declare const held24: MdyColorsFieldControllerOptions;
void held24;
declare const held25: MdyColorsFieldIntent;
void held25;
declare const held26: MdyColorsFieldPreset;
void held26;
declare const held27: MdyColorsFieldState;
void held27;
declare const held28: MdyCommandDefer;
void held28;
declare const held29: MdyCommandRuntime;
void held29;
declare const held30: MdyCommandRuntimeOptions;
void held30;
declare const held31: MdyCommandTarget;
void held31;
declare const held32: MdyControllerNotify;
void held32;
declare const held33: MdyDateDraftIntent;
void held33;
declare const held34: MdyDateDraftState;
void held34;
declare const held35: MdyDateDraftTransition;
void held35;
declare const held36: MdyDateRangeDraftIntent;
void held36;
declare const held37: MdyDateRangeDraftState;
void held37;
declare const held38: MdyDateRangeDraftTransition;
void held38;
declare const held39: MdyDateRangeValue;
void held39;
declare const held40: MdyDateValueIntent;
void held40;
declare const held41: MdyDatepickerFieldA11yOptions;
void held41;
declare const held42: MdyDatepickerFieldCell;
void held42;
declare const held43: MdyDatepickerFieldControllerOptions;
void held43;
declare const held44: MdyDatepickerFieldIntent;
void held44;
declare const held45: MdyDatepickerFieldState;
void held45;
declare const held46: MdyDaterangeFieldA11yOptions;
void held46;
declare const held47: MdyDaterangeFieldCell;
void held47;
declare const held48: MdyDaterangeFieldControllerOptions;
void held48;
declare const held49: MdyDaterangeFieldIntent;
void held49;
declare const held50: MdyDaterangeFieldState;
void held50;
declare const held51: MdyDismissalBindingOptions;
void held51;
declare const held52: MdyDismissalPhase;
void held52;
declare const held53: MdyDragPoint;
void held53;
declare const held54: MdyElementTarget;
void held54;
declare const held55: MdyFieldShellA11yOptions;
void held55;
declare const held56: MdyFieldShellFlags;
void held56;
declare const held57: MdyFieldShellPart;
void held57;
declare const held58: MdyFieldVerdictSource;
void held58;
declare const held59: MdyFileCandidate;
void held59;
declare const held60: MdyFileFieldController<never>;
void held60;
declare const held61: MdyFileFieldControllerOptions<never>;
void held61;
declare const held62: MdyFileFieldIntent<never>;
void held62;
declare const held63: MdyFileFieldState<never>;
void held63;
declare const held64: MdyFileSelectionOptions;
void held64;
declare const held65: MdyFileSelectionTransition<never>;
void held65;
declare const held66: MdyFocusCustodian;
void held66;
declare const held67: MdyFormResetBinding;
void held67;
declare const held68: MdyFormShellPart;
void held68;
declare const held69: MdyGranularityProblem;
void held69;
declare const held70: MdyKeyBinding;
void held70;
declare const held71: MdyKeyOrPress;
void held71;
declare const held72: MdyLayoutBreakpoint;
void held72;
declare const held73: MdyLayoutColumnCounts;
void held73;
declare const held74: MdyLayoutPart;
void held74;
declare const held75: MdyLayoutSlotPlacement;
void held75;
declare const held76: MdyLightDismiss;
void held76;
declare const held77: MdyLightDismissOptions;
void held77;
declare const held78: MdyMultiselectFieldA11yOptions;
void held78;
declare const held79: MdyMultiselectFieldController<never>;
void held79;
declare const held80: MdyMultiselectFieldControllerOptions<never>;
void held80;
declare const held81: MdyMultiselectFieldIntent;
void held81;
declare const held82: MdyMultiselectFieldState<never>;
void held82;
declare const held83: MdyMultiselectOverlayAction;
void held83;
declare const held84: MdyMultiselectValueIntent<never>;
void held84;
declare const held85: MdyMultiselectWayBack;
void held85;
declare const held86: MdyNativeAttributes;
void held86;
declare const held87: MdyOptionFieldA11yOptions;
void held87;
declare const held88: MdyOptionFieldController<never>;
void held88;
declare const held89: MdyOptionFieldControllerOptions<never>;
void held89;
declare const held90: MdyOptionFieldIntent;
void held90;
declare const held91: MdyOptionFieldState<never>;
void held91;
declare const held92: MdyOptionFieldVariant;
void held92;
declare const held93: MdyOptionNavigationTarget;
void held93;
declare const held94: MdyOutsideDismiss;
void held94;
declare const held95: MdyOverlayAnchorOptions;
void held95;
declare const held96: MdyOverlayAnchoring;
void held96;
declare const held97: MdyOverlayGeometry;
void held97;
declare const held98: MdyOverlayLifecycleState;
void held98;
declare const held99: MdyOverlayLifecycleTransition;
void held99;
declare const held100: MdyOverlayOpenerA11yOptions;
void held100;
declare const held101: MdyOverlayPhase;
void held101;
declare const held102: MdyOverlayPlacementResult;
void held102;
declare const held103: MdyOverlayProperty;
void held103;
declare const held104: MdyOverlayRoot;
void held104;
declare const held105: MdyPartMap<never>;
void held105;
declare const held106: MdyPartPresence;
void held106;
declare const held107: MdyPartState;
void held107;
declare const held108: MdyPointerDrag;
void held108;
declare const held109: MdyPointerDragOptions;
void held109;
declare const held110: MdyPointerOrigin;
void held110;
declare const held111: MdyRelationAttribute;
void held111;
declare const held112: MdySelectA11yOptions;
void held112;
declare const held113: MdySelectA11yProjection;
void held113;
declare const held114: MdySelectController<never>;
void held114;
declare const held115: MdySelectControllerOptions<never>;
void held115;
declare const held116: MdySelectKeyboardAction;
void held116;
declare const held117: MdySelectMoveTarget;
void held117;
declare const held118: MdySelectReconciliationState<never>;
void held118;
declare const held119: MdySilentWriteBinding;
void held119;
declare const held120: MdyStateName;
void held120;
declare const held121: MdySubmissionShape;
void held121;
declare const held122: MdyTextFieldA11yOptions;
void held122;
declare const held123: MdyTextFieldControllerOptions<never>;
void held123;
declare const held124: MdyTextFieldIntent<never>;
void held124;
declare const held125: MdyTimeClockIntent;
void held125;
declare const held126: MdyTimeDraftIntent;
void held126;
declare const held127: MdyTimeDraftState;
void held127;
declare const held128: MdyTimeDraftTransition;
void held128;
declare const held129: MdyTimeEntry;
void held129;
declare const held130: MdyTimeField;
void held130;
declare const held131: MdyTimeFieldBounds;
void held131;
declare const held132: MdyTimeRejection;
void held132;
declare const held133: MdyTimeWindow;
void held133;
declare const held134: MdyTimepickerDialArc;
void held134;
declare const held135: MdyTimepickerDialGhost;
void held135;
declare const held136: MdyTimepickerDialKeyResult;
void held136;
declare const held137: MdyTimepickerDialNumber;
void held137;
declare const held138: MdyTimepickerDialPick;
void held138;
declare const held139: MdyTimepickerEntry;
void held139;
declare const held140: MdyTimepickerFieldA11yOptions;
void held140;
declare const held141: MdyTimepickerFieldController;
void held141;
declare const held142: MdyTimepickerFieldControllerOptions;
void held142;
declare const held143: MdyTimepickerFieldState;
void held143;
declare const held144: MdyTransitionTrigger;
void held144;
declare const held145: MdyTypeahead;
void held145;
declare const held146: MdyTypeaheadOptions;
void held146;
declare const held147: MdyTypedWidgetViewContract<never>;
void held147;
declare const held148: MdyValueWidgetControllerOptions<never>;
void held148;
declare const held149: MdyValueWidgetState<never>;
void held149;
declare const held150: MdyViewportSize;
void held150;
declare const held151: MdyVocabulary;
void held151;
declare const held152: MdyVocabularyShape;
void held152;
declare const held153: MdyWidgetCommandContext;
void held153;
declare const held154: MdyWidgetCommandExecutor;
void held154;
declare const held155: MdyWidgetController<never, never>;
void held155;
declare const held156: MdyWidgetDefinition;
void held156;
declare const held157: MdyWidgetIdFactory;
void held157;
declare const held158: MdyWidgetKeyIntent;
void held158;
declare const held159: MdyWidgetRelation;
void held159;
declare const held160: MdyWidgetRuntimeCapabilities;
void held160;
declare const held161: MdyWidgetSemanticElement;
void held161;
declare const held162: MdyWidgetState;
void held162;
declare const held163: MdyWidgetStateContract;
void held163;
declare const held164: MdyWidgetStructure;
void held164;
declare const held165: MdyWidgetStructureNode;
void held165;
declare const held166: MdyWidgetTransition;
void held166;
declare const held167: MdyWidgetVariant;
void held167;
declare const held168: MdyWidgetViewContract;
void held168;
declare const held169: MdyAsyncValidationContext;
void held169;
declare const held170: MdyBatchingCapability;
void held170;
declare const held171: MdyContextRef;
void held171;
declare const held172: MdyCoreFormOptions;
void held172;
declare const held173: MdyDiagnosticSeverity;
void held173;
declare const held174: MdyDynamicArrayNode;
void held174;
declare const held175: MdyDynamicBooleanField;
void held175;
declare const held176: MdyDynamicCalendarOptions;
void held176;
declare const held177: MdyDynamicCollection;
void held177;
declare const held178: MdyDynamicColorsField;
void held178;
declare const held179: MdyDynamicColumns;
void held179;
declare const held180: MdyDynamicDateField;
void held180;
declare const held181: MdyDynamicDaterangeField;
void held181;
declare const held182: MdyDynamicFieldNode;
void held182;
declare const held183: MdyDynamicFileField;
void held183;
declare const held184: MdyDynamicFlatForm;
void held184;
declare const held185: MdyDynamicFormConfig;
void held185;
declare const held186: MdyDynamicFormConfigV2;
void held186;
declare const held187: MdyDynamicFormConfigV3;
void held187;
declare const held188: MdyDynamicFormDocument;
void held188;
declare const held189: MdyDynamicFormParseResult;
void held189;
declare const held190: MdyDynamicGroupNode;
void held190;
declare const held191: MdyDynamicNode;
void held191;
declare const held192: MdyDynamicNumberField;
void held192;
declare const held193: MdyDynamicOptionsField;
void held193;
declare const held194: MdyDynamicRecordNode;
void held194;
declare const held195: MdyDynamicRule;
void held195;
declare const held196: MdyDynamicRuleOperator;
void held196;
declare const held197: MdyDynamicSection;
void held197;
declare const held198: MdyDynamicTextField;
void held198;
declare const held199: MdyDynamicValidation;
void held199;
declare const held200: MdyDynamicValidators;
void held200;
declare const held201: MdyEqualityFn<never>;
void held201;
declare const held202: MdyExpression;
void held202;
declare const held203: MdyExpressionOp;
void held203;
declare const held204: MdyExpressionScope;
void held204;
declare const held205: MdyFieldKind;
void held205;
declare const held206: MdyFlushCapability;
void held206;
declare const held207: MdyFormEngineOptions;
void held207;
declare const held208: MdyObserveCapability;
void held208;
declare const held209: MdyObserveOptions<never>;
void held209;
declare const held210: MdyOperand;
void held210;
declare const held211: MdyPathGate;
void held211;
declare const held212: MdyPathRef;
void held212;
declare const held213: MdyReactivityCapabilities;
void held213;
declare const held214: MdyRootRef;
void held214;
declare const held215: MdySanitizeProfile;
void held215;
declare const held216: MdyScopeOptions;
void held216;
declare const held217: MdySecurityViolation;
void held217;
declare const held218: MdySecurityViolationKind;
void held218;
declare const held219: MdySelfRef;
void held219;
declare const held220: MdyServerValidatorOptions;
void held220;
declare const held221: MdySubmittedItemValue<never>;
void held221;
declare const held222: MdyValidationMessages;
void held222;
declare const held223: MdyValidatorFacts;
void held223;
declare const held224: MdyValueCommit;
void held224;
declare const held225: MdyValueContract;
void held225;
declare const held226: MdyValueSecurityResult;
void held226;
declare const held227: MdyValueShape;
void held227;
declare const held228: MdyWebStorageLike;
void held228;
declare const held229: MdyDynamicBreakpoint;
void held229;
declare const held230: MdyDynamicSlotPlacement;
void held230;
declare const held231: MdyDraftStorage;
void held231;
declare const held232: MdyCalendarIssue;
void held232;
declare const held233: MdyCalendarIssueCode;
void held233;
declare const held234: MdyCanonicalOptions;
void held234;
declare const held235: MdyCanonicalOverlay;
void held235;
declare const held236: MdyCanonicalPart;
void held236;
declare const held237: MdyCanonicalRelationship;
void held237;
declare const held238: MdyCanonicalSnapshot;
void held238;
declare const held239: MdyDomContractIssue;
void held239;
declare const held240: MdyDomContractIssueCode;
void held240;
declare const held241: MdyDomContractOptions;
void held241;
declare const held242: MdyDomPartMap;
void held242;
declare const held243: MdyLifecycleIssue;
void held243;
declare const held244: MdyLifecycleIssueCode;
void held244;
declare const held245: MdyLifecycleTransition;
void held245;
declare const held246: MdyPaintBeat;
void held246;
declare const held247: MdySelectTransitionFixture;
void held247;
declare const held248: MdyStateInspectOptions;
void held248;
declare const held249: MdyStateIssue;
void held249;
declare const held250: MdyStateIssueCode;
void held250;
declare const held251: MdyStateMatrixOptions;
void held251;
declare const held252: MdyStateMatrixResult;
void held252;
declare const held253: MdyStateMatrixRow;
void held253;
declare const held254: MdyStructureContractIssue;
void held254;
declare const held255: MdyTestingVocabulary;
void held255;
declare const held256: MdyUnmountObservation;
void held256;
declare const held257: typeof assertWidgetStructureContract;
void held257;
declare const held258: typeof expectedWeekdayOrder;
void held258;
declare const held259: typeof inspectUnsupportedStateAria;
void held259;
declare const held260: MdySnapshotOptions;
void held260;
declare const held261: MdyAsyncDraftStorage;
void held261;
declare const held262: MdyAsyncDraftStorageOptions;
void held262;
declare const held263: MdyAsyncKeyValueStore;
void held263;
declare const held264: MdyReactivityTestHarness;
void held264;
declare const held265: typeof addDays;
void held265;
declare const held266: typeof addYears;
void held266;
declare const held267: typeof firstWeekday;
void held267;
declare const held268: typeof getPointerCoords;
void held268;
declare const held269: typeof localeDateOrder;
void held269;
declare const held270: typeof parse24Time;
void held270;
declare const held271: ParsedTime;
void held271;
declare const held272: typeof angleToHour;
void held272;
declare const held273: typeof angleToMinute;
void held273;

import type { MDY_SCOPE_DESTROYED, MDY_SSR_SNAPSHOT_MISMATCH } from "@modyra/core";
import type { scrollOptionIntoView } from "@modyra/widgets";

/** Three names published as values: what is asserted of them is the same floor. */
declare const heldScopeDestroyed: typeof MDY_SCOPE_DESTROYED;
void heldScopeDestroyed;
declare const heldSnapshotMismatch: typeof MDY_SSR_SNAPSHOT_MISMATCH;
void heldSnapshotMismatch;
declare const heldScrollOption: typeof scrollOptionIntoView;
void heldScrollOption;
declare const heldOpenModality: MdyOpenModality;
void heldOpenModality;
