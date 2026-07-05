import type { ReactNode } from "react";
import Heading from "@theme/Heading";
import clsx from "clsx";
import styles from "./styles.module.css";

type FeatureItem = {
    title: string;
    Svg: React.ComponentType<React.ComponentProps<"svg">>;
    description: ReactNode;
};

const FeatureList: FeatureItem[] = [
    {
        title: "Fast and easy to start",
        Svg: require("@site/static/img/undraw_docusaurus_react.svg").default,
        description: <>Read our Tutorial with comprehensive instructions for a quick and easy project use.</>,
    },
    {
        title: "Focus on What you need",
        Svg: require("@site/static/img/undraw_docusaurus_mountain.svg").default,
        description: (
            <>
                If you need to find answear on your question just go to the <code>docs</code> and look for the related topic.
            </>
        ),
    },
    {
        title: "Contant Us",
        Svg: require("@site/static/img/undraw_docusaurus_tree.svg").default,
        description: (
            <>
                If you still missing something, just contact us via <a href="mailto:cluster-map@artemk.work">cluster-map@artemk.work</a> and we will be happy to
                help!
            </>
        ),
    },
];

function Feature({ title, Svg, description }: FeatureItem) {
    return (
        <div className={clsx("col col--4")}>
            <div className="text--center">
                <Svg className={styles.featureSvg} role="img" />
            </div>
            <div className="text--center padding-horiz--md">
                <Heading as="h3">{title}</Heading>
                <p>{description}</p>
            </div>
        </div>
    );
}

export default function HomepageFeatures(): ReactNode {
    return (
        <section className={styles.features}>
            <div className="container">
                <div className="row">
                    {FeatureList.map((props, idx) => (
                        <Feature key={idx} {...props} />
                    ))}
                </div>
            </div>
        </section>
    );
}
