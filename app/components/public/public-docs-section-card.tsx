import { Text, View } from "react-native";

import type { CharterPrincipleCard } from "@/app/public/content-types";

type PublicDocsSectionCardProps = {
  section: CharterPrincipleCard;
};

export function PublicDocsSectionCard({ section }: PublicDocsSectionCardProps) {
  const isRightAnchored = section.anchor === "right";

  const titleWrapClassName = isRightAnchored ? "items-end" : "items-start";
  const titleClassName = isRightAnchored ? "text-right" : "text-left";
  const detailWrapClassName = isRightAnchored ? "items-start" : "items-end";
  const detailClassName = isRightAnchored ? "text-left" : "text-right";
  const eyebrowClassName = isRightAnchored ? "text-right" : "text-left";
  const hairlineClassName = isRightAnchored ? "self-end" : "self-start";

  return (
    <View className="min-w-[280px] flex-1 self-stretch rounded-[28px] border border-[#1c4f79] bg-[#031129] px-7 py-7">
      <View className="pointer-events-none absolute left-0 top-0 h-full w-full overflow-hidden rounded-[28px]">
        <View className="absolute -left-12 -top-12 h-40 w-40 rounded-full bg-[#14355c]/45" />
        <View className="absolute -bottom-14 right-[-10%] h-44 w-44 rounded-full bg-[#102c4d]/35" />
      </View>

      <View className="flex-1 justify-between gap-10">
        <View className={titleWrapClassName}>
          <View className={["mb-5 w-full max-w-[92%] border-t border-[#244e77]", hairlineClassName].join(" ")} />
          <Text
            className={[
              "mb-3 font-[Orbitron_700Bold] text-[10px] uppercase tracking-[3px] text-[#89afe0]",
              eyebrowClassName,
            ].join(" ")}
          >
            Principle {section.principle}
          </Text>
          <Text
            className={[
              "max-w-[92%] font-[Inter_700Bold] text-[30px] leading-[34px] text-[#b8d7ff]",
              titleClassName,
            ].join(" ")}
          >
            {section.title}
          </Text>
        </View>

        <View className={detailWrapClassName}>
          <Text
            className={[
              "max-w-[92%] font-[Inter_500Medium] text-[16px] leading-[24px] text-[#f3f8d6]",
              detailClassName,
            ].join(" ")}
          >
            {section.body}
          </Text>
          <View className={["mt-5 w-full max-w-[92%] border-t border-[#244e77]", hairlineClassName].join(" ")} />
        </View>
      </View>
    </View>
  );
}

export default PublicDocsSectionCard;
