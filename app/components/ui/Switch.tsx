import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

const Switch = React.forwardRef<
    React.ElementRef<typeof SwitchPrimitives.Root>,
    React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
    <SwitchPrimitives.Root
        className={`
      peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full 
      border-2 border-transparent transition-colors 
      focus-visible:outline-none focus-visible:ring-2 
      focus-visible:ring-bolt-elements-borderColor 
      focus-visible:ring-offset-2 
      focus-visible:ring-offset-bolt-elements-background 
      disabled:cursor-not-allowed disabled:opacity-50 
      data-[state=checked]:bg-bolt-elements-button-primary-background
      data-[state=unchecked]:bg-bolt-elements-background-depth-3
      ${className}`}
        {...props}
        ref={ref}
    >
        <SwitchPrimitives.Thumb
            className={`
        pointer-events-none block h-5 w-5 rounded-full 
        bg-white shadow-lg ring-0 transition-transform 
        data-[state=checked]:translate-x-5 
        data-[state=unchecked]:translate-x-0
        data-[state=checked]:bg-white
        data-[state=unchecked]:bg-bolt-elements-textSecondary
      `}
        />
    </SwitchPrimitives.Root>
));

Switch.displayName = "Switch";

export { Switch };