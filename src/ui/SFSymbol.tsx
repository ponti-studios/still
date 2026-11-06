import { requireNativeComponent, type ViewProps, type ViewStyle } from 'react-native';

export type SymbolWeight =
  | 'ultralight' | 'thin' | 'light' | 'regular'
  | 'medium' | 'semibold' | 'bold' | 'heavy' | 'black';

type NativeProps = ViewProps & {
  name: string;
  pointSize?: number;
  weight?: SymbolWeight;
  color?: string;
};

const NativeSFSymbol = requireNativeComponent<NativeProps>('SFSymbolView');

/** A true SF Symbol, rendered natively. Never emoji. */
export function SFSymbol({ name, size = 17, weight = 'regular', color, style }: {
  name: string;
  size?: number;
  weight?: SymbolWeight;
  color?: string;
  style?: ViewStyle;
}) {
  return (
    <NativeSFSymbol
      name={name}
      pointSize={size}
      weight={weight}
      color={color}
      style={[{ width: size, height: size }, style]}
    />
  );
}
