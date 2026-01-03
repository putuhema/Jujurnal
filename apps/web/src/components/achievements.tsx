"use client";

import { api } from "@puma-brain/backend/convex/_generated/api";
import { useQuery } from "convex/react";
import { TrophyIcon } from "@phosphor-icons/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Badge } from "./ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";

const rarityColors = {
  common: "bg-gray-500/20 text-gray-700 dark:text-gray-300",
  rare: "bg-blue-500/20 text-blue-700 dark:text-blue-300",
  epic: "bg-purple-500/20 text-purple-700 dark:text-purple-300",
  legendary: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300",
};

const rarityBorders = {
  common: "border-gray-500/30",
  rare: "border-blue-500/30",
  epic: "border-purple-500/30",
  legendary: "border-yellow-500/30",
};

export const Achievements = () => {
  const userAchievements = useQuery(api.achievements.getUserAchievements);
  const allBadges = useQuery(api.achievements.getAllBadges);

  if (!userAchievements || !allBadges) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrophyIcon size={24} />
            Achievements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            Loading achievements...
          </div>
        </CardContent>
      </Card>
    );
  }

  // Only show unlocked badges
  const unlockedBadges = userAchievements
    .map((achievement) => {
      const badge = allBadges.find((b) => b.id === achievement.badgeId);
      return badge ? { ...badge, achievement } : null;
    })
    .filter((badge): badge is NonNullable<typeof badge> => badge !== null)
    .sort((a, b) => {
      // Sort by unlock date (most recent first), then by name
      const dateA = a.achievement.unlockedAt;
      const dateB = b.achievement.unlockedAt;
      if (dateB !== dateA) return dateB - dateA;
      return a.name.localeCompare(b.name);
    });

  // Group unlocked badges by rarity
  const badgesByRarity = {
    legendary: [] as typeof unlockedBadges,
    epic: [] as typeof unlockedBadges,
    rare: [] as typeof unlockedBadges,
    common: [] as typeof unlockedBadges,
  };

  for (const badge of unlockedBadges) {
    badgesByRarity[badge.rarity].push(badge);
  }

  const unlockedCount = userAchievements.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrophyIcon size={24} />
          Achievements
        </CardTitle>
        <CardDescription>
          {unlockedCount} {unlockedCount === 1 ? "badge" : "badges"} unlocked
        </CardDescription>
      </CardHeader>
      <CardContent>
        {unlockedCount === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <TrophyIcon size={48} className="mx-auto mb-4 opacity-50" />
            <p>No achievements unlocked yet.</p>
            <p className="text-sm mt-2">
              Start journaling to unlock your first badge!
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {(["legendary", "epic", "rare", "common"] as const).map(
              (rarity) => {
                const badges = badgesByRarity[rarity];
                if (badges.length === 0) return null;

                return (
                  <div key={rarity} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold capitalize">
                        {rarity}
                      </h3>
                      <Badge variant="outline" className="text-xs">
                        {badges.length}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {badges.map((badge) => (
                        <TooltipProvider key={badge.id}>
                          <Tooltip>
                            <TooltipTrigger>
                              <div
                                className={`
                                relative p-4 rounded-lg border-2 transition-all
                                ${rarityBorders[badge.rarity]}
                                opacity-100 hover:scale-105 cursor-pointer
                              `}
                              >
                                <div className="text-center space-y-2">
                                  <div className="text-4xl">{badge.icon}</div>
                                  <div className="text-xs font-medium">
                                    {badge.name}
                                  </div>
                                </div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                              <div className="space-y-1">
                                <div className="font-semibold">
                                  {badge.name}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {badge.description}
                                </div>
                                <div className="text-xs text-muted-foreground pt-1 border-t">
                                  Unlocked{" "}
                                  {new Date(
                                    badge.achievement.unlockedAt
                                  ).toLocaleDateString()}
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ))}
                    </div>
                  </div>
                );
              }
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
