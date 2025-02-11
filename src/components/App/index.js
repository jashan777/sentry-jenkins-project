//import 'whatwg-fetch';
//import '@babel/polyfill';
//import 'regenerator-runtime/runtime';

import React from "react";
import ReactDOM from "react-dom";

// Note: Using an Alias in Webpack
import Header from 'components/Header/';
import Menu from 'components/Menu/';
import Bottom from 'components/Bottom/';


class App extends React.Component { 

   render() {
	   
      return (
         <div>
		  <Header />	 
        return <button onClick={() => {throw new Error("This is your first error!");}}>Break the world</button>;
		    <Menu />
		  <Bottom />
		
         </div>
      );
   }
}

export default App;