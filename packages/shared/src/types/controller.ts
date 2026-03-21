/**
 * Controller layout system — games define which controls appear on players' phones.
 */

export interface ControlButton {
  type: 'button';
  id: string;
  label: string;
  /** CSS color string, e.g. '#ef4444' */
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  /** Where on screen this button appears */
  position: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right' | 'center';
}

export interface ControlDPad {
  type: 'dpad';
  id: string;
  position: 'left' | 'right' | 'center';
}

export interface ControlJoystick {
  type: 'joystick';
  id: string;
  label?: string;
  position: 'left' | 'right' | 'center';
}

export interface ControlSwipeArea {
  type: 'swipe';
  id: string;
  label?: string;
}

export type ControlDefinition =
  | ControlButton
  | ControlDPad
  | ControlJoystick
  | ControlSwipeArea;

export interface ControllerLayout {
  controls: ControlDefinition[];
}

/**
 * Typed input events sent by the player to the server via PLAYER_INPUT.
 */
export type ControllerInputEvent =
  | { control: string; action: 'button_down' | 'button_up' }
  | { control: string; action: 'joystick'; x: number; y: number }
  | { control: string; action: 'dpad'; direction: 'up' | 'down' | 'left' | 'right' | null }
  | { control: string; action: 'swipe'; direction: 'up' | 'down' | 'left' | 'right' };
