import type { Value, ValueController, ViewProps } from "@tweakpane/core";
import { GradientStopsView } from "./gradient-view.js";
import type { GradientStopsValue } from "./types.js";

export class GradientStopsController implements ValueController<GradientStopsValue> {
  public readonly value: Value<GradientStopsValue>;
  public readonly view: GradientStopsView;
  public readonly viewProps: ViewProps;

  public constructor(doc: Document, config: { value: Value<GradientStopsValue>; viewProps: ViewProps }) {
    this.value = config.value;
    this.viewProps = config.viewProps;
    this.view = new GradientStopsView(doc, { value: this.value, viewProps: this.viewProps });
  }
}
