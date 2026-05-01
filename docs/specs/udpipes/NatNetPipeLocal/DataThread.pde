public class DataThread extends Thread {
  boolean isRunning;
  byte[] buf = new byte[packageSize_data];

  public void kill() {
    isRunning = false;
  }

  public void run() {
    System.out.println("DataThread is running...");
    isRunning = true;
    DatagramPacket NatNetDataPacket = new DatagramPacket(buf, buf.length);
    while (isRunning) {
      try {
        while (true) {     
          // listening to motive data from motive directly
          motiveClient_Data.receive(NatNetDataPacket);

          byte[] newArray = trimmByteArray(NatNetDataPacket);
          sizeDataMsg = newArray.length;
          
          if(verbose_data){  
            println();
            print("data package: Motive ("+NatNetDataPacket.getPort()+") -> Server (" + telematicPort_Data + ")");
            printOutByteArray(newArray);  
          }
          
          // passing on motive datato telematic server data port
          DatagramPacket proxyPacket = new DatagramPacket(newArray, newArray.length, telematicAddress, telematicPort_Data);
          telematicServer_Data.send(proxyPacket);
          
          //println(countDataMsgs);         
          countDataMsgs++;
        }
      } 
      catch(Exception e) {
        ;
      }
    }
  }
}
