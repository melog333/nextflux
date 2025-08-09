import { useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useStore } from "@nanostores/react";
import {
  activeArticle,
  filteredArticles,
  imageGalleryActive,
  loadArticles,
  filter,
} from "@/stores/articlesStore";
import {
  handleMarkStatus,
  handleToggleStar,
  handleToggleContent,
} from "@/handlers/articleHandlers";
import { forceSync } from "@/stores/syncStore";
import {
  searchDialogOpen,
  addFeedModalOpen,
  shortcutsModalOpen,
} from "@/stores/modalStore.js";
import { useSidebarNavigation } from "@/hooks/useSidebarNavigation";

export function useHotkeys() {
  const navigate = useNavigate();
  const location = useLocation();
  const $articles = useStore(filteredArticles);
  const $activeArticle = useStore(activeArticle);
  const $imageGalleryActive = useStore(imageGalleryActive);
  const { articleId } = useParams();
  const { navigateToPrevious, navigateToNext, toggleCurrentCategory } = useSidebarNavigation();

  // 获取当前文章在列表中的索引
  const currentIndex = $articles.findIndex((a) => a.id === $activeArticle?.id);

  // Fixed: Better basePath calculation that handles all cases
  const getBasePath = () => {
    const pathname = location.pathname;
    
    // If we're already on an article page, remove the article part
    if (pathname.includes("/article/")) {
      return pathname.split("/article/")[0];
    }
    
    // If we're on a feed page (e.g., /feed/123), stay there
    if (pathname.startsWith("/feed/")) {
      return pathname;
    }
    
    // If we're on a category page (e.g., /category/123), stay there  
    if (pathname.startsWith("/category/")) {
      return pathname;
    }
    
    // Default to root for home page
    return pathname === "/" ? "" : pathname;
  };

  useEffect(() => {
    const handleKeyDown = async (e) => {
      // 如果焦点在输入框中,不触发快捷键
      if (
        e.target.tagName === "INPUT" ||
        e.target.tagName === "TEXTAREA" ||
        e.target.isContentEditable
      ) {
        return;
      }

      if (e.key === "?" && e.shiftKey) {
        e.preventDefault();
        shortcutsModalOpen.set(!shortcutsModalOpen.get());
        return;
      }

      if (e.key === "N" && e.shiftKey) {
        e.preventDefault();
        addFeedModalOpen.set(!addFeedModalOpen.get());
        return;
      }

      switch (e.key.toLowerCase()) {
        case "f": // 搜索
          e.preventDefault();
          searchDialogOpen.set(true);
          break;

        case "j": // 下一篇 - FIXED VERSION
          e.preventDefault();
          if (!articleId) {
            // No article selected - navigate to first article
            if ($articles.length === 0) {
              console.log("No articles available");
              return;
            }
            const firstArticle = $articles[0];
            if (!firstArticle?.id) {
              console.log("First article has no ID");
              return;
            }
            
            const basePath = getBasePath();
            const targetPath = basePath ? `${basePath}/article/${firstArticle.id}` : `/article/${firstArticle.id}`;
            
            console.log("Navigating to first article:", targetPath);
            navigate(targetPath);
            
            if (firstArticle.status !== "read") {
              await handleMarkStatus(firstArticle);
            }
          } else if (currentIndex < $articles.length - 1) {
            // Article selected - navigate to next article
            const nextArticle = $articles[currentIndex + 1];
            if (!nextArticle?.id) {
              return;
            }
            
            const basePath = getBasePath();
            const targetPath = basePath ? `${basePath}/article/${nextArticle.id}` : `/article/${nextArticle.id}`;
            
            navigate(targetPath);
            if (nextArticle.status !== "read") {
              await handleMarkStatus(nextArticle);
            }
          }
          break;

        case "k": // 上一篇
          e.preventDefault();
          if (currentIndex > 0) {
            const prevArticle = $articles[currentIndex - 1];
            if (!prevArticle?.id) {
              return;
            }
            
            const basePath = getBasePath();
            const targetPath = basePath ? `${basePath}/article/${prevArticle.id}` : `/article/${prevArticle.id}`;
            
            navigate(targetPath);
            if (prevArticle.status !== "read") {
              await handleMarkStatus(prevArticle);
            }
          }
          break;

        case "m": // 标记已读/未读
          if (articleId) {
            await handleMarkStatus($activeArticle);
          }
          break;

        case "s": // 收藏/取消收藏
          if (articleId) {
            await handleToggleStar($activeArticle);
          }
          break;

        case "r": // 刷新 - Enhanced with clear view
  e.preventDefault();
  if (!e.ctrlKey && !e.metaKey) {
    console.log("Refresh: Starting sync and clear process");
    
    // Perform the sync
    await forceSync();
    
    // Wait for sync to complete, then clear the view
    setTimeout(async () => {
      try {
        // 1. Clear active article (deselect)
        activeArticle.set(null);
        
        // 2. Switch to unread filter to hide read articles
        filter.set("unread");
        
        // 3. Navigate to home view (clear any feed/category selection)
        navigate("/");
        
        // 4. Reload articles with unread filter
        await loadArticles(null, "feed", 1, false);
        
        console.log("Refresh complete: View cleared, switched to unread, article deselected");
        
      } catch (error) {
        console.error("Failed to clear view after refresh:", error);
      }
    }, 1000); // Wait 1 second for sync to complete
  }
  break;
        case "escape": // 关闭文章
          if ($imageGalleryActive) {
            return;
          } else {
            const basePath = getBasePath();
            navigate(basePath || "/");
          }
          break;

        case "v": // 在新标签页打开原文
          if (articleId) {
            window.open($activeArticle.url, "_blank");
          }
          break;

        case "g": // 原文/摘要切换
          if (articleId) {
            await handleToggleContent($activeArticle);
          }
          break;

        case "p": // 上一个订阅或分组
          e.preventDefault();
          navigateToPrevious();
          break;

        case "n": // 下一个订阅或分组
          e.preventDefault();
          navigateToNext();
          break;

        case "x": // 切换分组展开状态
          e.preventDefault();
          toggleCurrentCategory();
          break;

        default:
          break;
      }
    };

    const target = window;
    target.addEventListener("keydown", handleKeyDown);

    return () => {
      target.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    $activeArticle,
    currentIndex,
    $articles,
    navigate,
    articleId,
    location.pathname, // Added this dependency
    $imageGalleryActive,
    navigateToPrevious,
    navigateToNext,
    toggleCurrentCategory,
  ]);
}
