import { Grid } from 'antd'

const { useBreakpoint } = Grid

/**
 * Hook dùng chung để xử lý responsive layout theo chuẩn Ant Design breakpoints.
 * Dùng thay vì viết logic lặp lại ở mỗi file.
 *
 * Breakpoints: xs < 576px | sm >= 576 | md >= 768 | lg >= 992 | xl >= 1200
 *
 * @returns {Object}
 *   - isMobile: xs/sm (< 768px) — điện thoại
 *   - isTablet: md (768–991px) — tablet
 *   - isDesktop: lg+ (>= 992px)
 *   - padding: padding chuẩn theo screen size (12/16/24)
 *   - gutter: gutter cho Row/Col theo screen
 *   - screens: raw breakpoint object từ Ant Design
 */
export function useResponsive() {
  const screens = useBreakpoint()

  const isMobile = !screens.md   // < 768px
  const isTablet = screens.md && !screens.lg  // 768–991px
  const isDesktop = !!screens.lg  // >= 992px

  // Padding chuẩn theo màn hình
  const padding = isMobile ? 12 : isTablet ? 16 : 24

  // Gutter cho Row/Col
  const gutter = isMobile ? [8, 8] : isTablet ? [12, 12] : [16, 16]

  return {
    isMobile,
    isTablet,
    isDesktop,
    padding,
    gutter,
    screens,
  }
}
