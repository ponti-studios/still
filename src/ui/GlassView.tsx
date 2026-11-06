import { requireNativeComponent, type ViewProps, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';

type NativeProps = ViewProps & {
  cornerRadius?: number;
};

const NativeGlass = requireNativeComponent<NativeProps>('GlassView');

/**
 * Liquid Glass on iOS 26 (thin material below), hosting RN children above it.
 * One surface at a time — glass is a highlight, not a theme.
 */
export function GlassView({ cornerRadius = 20, style, children }: {
  cornerRadius?: number;
  style?: ViewStyle;
  children?: ReactNode;
}) {
  return (
    <NativeGlass cornerRadius={cornerRadius} style={style}>
      {children}
    </NativeGlass>
  );
}
