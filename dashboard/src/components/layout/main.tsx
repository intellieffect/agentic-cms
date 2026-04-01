import { cn } from "@/lib/utils";

interface MainProps extends React.HTMLAttributes<HTMLElement> {
  fixed?: boolean;
}

export function Main({ fixed, className, ...props }: MainProps) {
  return (
    <main
      className={cn(
        "flex-1 overflow-y-auto overflow-x-hidden px-4 py-6 md:px-6 lg:px-8",
        fixed && "flex grow flex-col overflow-hidden",
        className
      )}
      {...props}
    />
  );
}
