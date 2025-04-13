interface MobileHeaderProps {
  toggleMenu: () => void;
}

const MobileHeader = ({ toggleMenu }: MobileHeaderProps) => {
  return (
    <header className="md:hidden bg-white border-b border-gray-200 p-4 flex items-center justify-between">
      <h1 className="text-lg font-semibold text-primary-600">Revenue Share</h1>
      <button 
        className="text-gray-500 hover:text-gray-700"
        onClick={toggleMenu}
        aria-label="Toggle menu"
      >
        <i className="ri-menu-line text-xl"></i>
      </button>
    </header>
  );
};

export default MobileHeader;
