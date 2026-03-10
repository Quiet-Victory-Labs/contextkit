import type {
  InputHTMLAttributes,
  TextareaHTMLAttributes,
  SelectHTMLAttributes,
  ReactNode,
} from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export function Input({ error = false, className, ...props }: InputProps) {
  const classes = ['rc-input', error && 'rc-input--error', className]
    .filter(Boolean)
    .join(' ');

  return <input className={classes} {...props} />;
}

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export function Textarea({
  error = false,
  className,
  ...props
}: TextareaProps) {
  const classes = ['rc-textarea', error && 'rc-textarea--error', className]
    .filter(Boolean)
    .join(' ');

  return <textarea className={classes} {...props} />;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
  children?: ReactNode;
}

export function Select({
  error = false,
  className,
  children,
  ...props
}: SelectProps) {
  const classes = ['rc-select', error && 'rc-select--error', className]
    .filter(Boolean)
    .join(' ');

  return (
    <select className={classes} {...props}>
      {children}
    </select>
  );
}
