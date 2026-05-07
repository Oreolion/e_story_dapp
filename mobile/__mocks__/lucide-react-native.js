// Mock for lucide-react-native — replaces SVG icons with lightweight spans
const React = require('react');

const mockIcon = (name) => {
  const Icon = (props) =>
    React.createElement('span', { style: { color: props?.color, fontSize: props?.size } }, name);
  return Icon;
};

module.exports = {
  ArrowLeft: mockIcon('ArrowLeft'),
  Check: mockIcon('Check'),
  X: mockIcon('X'),
  Star: mockIcon('Star'),
  Zap: mockIcon('Zap'),
  Copy: mockIcon('Copy'),
  CopyCheck: mockIcon('CopyCheck'),
  RefreshCw: mockIcon('RefreshCw'),
  Wallet: mockIcon('Wallet'),
  User: mockIcon('User'),
  LogOut: mockIcon('LogOut'),
  Mail: mockIcon('Mail'),
  Edit3: mockIcon('Edit3'),
  Camera: mockIcon('Camera'),
  Trash2: mockIcon('Trash2'),
  Crown: mockIcon('Crown'),
  ChevronRight: mockIcon('ChevronRight'),
  AlertTriangle: mockIcon('AlertTriangle'),
};
