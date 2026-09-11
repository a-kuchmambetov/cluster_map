import useBaseUrl from "@docusaurus/useBaseUrl";
import clsx from "clsx";

type ThemeImageProps = {
    src: string;
    alt: string;
    darkSrc?: string;
    className?: string;
};

export default function ThemeImage({ src, alt, darkSrc, className }: ThemeImageProps) {
    const lightImageSrc = useBaseUrl(src);
    const darkImageSrc = useBaseUrl(darkSrc ?? src);

    if (!darkSrc) {
        return <img src={lightImageSrc} alt={alt} className={clsx("themeImage", className)} />;
    }

    return (
        <>
            <img src={lightImageSrc} alt={alt} className={clsx("themeImage", "themeImageLight", className)} />
            <img src={darkImageSrc} alt={alt} className={clsx("themeImage", "themeImageDark", className)} />
        </>
    );
}
